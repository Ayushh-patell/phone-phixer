// scripts/migrateTreeNodesFromUsers.js
import "dotenv/config";
import mongoose from "mongoose";
import User from "./models/User.js";
import TreeNode from "./models/TreeNode.js";

/**
 * Usage:
 *   node scripts/migrateTreeNodesFromUsers.js
 *
 * Env:
 *   MONGO_URI=...
 */

function idStr(v) {
  if (!v) return null;
  return String(v);
}

function keySlot(treeOwnerId, parentUserId, side) {
  return `${treeOwnerId}:${parentUserId}:${side}`;
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("❌ Missing MONGO_URI in environment.");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Ensure indexes exist (esp. unique constraints)
  await TreeNode.syncIndexes();
  console.log("✅ TreeNode indexes synced");

  // Load users (lean for speed & easy in-memory map)
  const users = await User.find({})
    .select("_id referralUsed referredBy leftChild rightChild placementCache role")
    .lean();

  console.log(`✅ Loaded users: ${users.length}`);

  const userById = new Map(users.map((u) => [idStr(u._id), u]));

  // ---------------------------
  // Step 1: Ensure root node for every user (treeOwner=user, user=user)
  // ---------------------------
  let rootUpserts = 0;

  for (const u of users) {
    const uid = idStr(u._id);

    // upsert root
    const res = await TreeNode.updateOne(
      { treeOwner: u._id, user: u._id },
      {
        $setOnInsert: {
          treeOwner: u._id,
          user: u._id,
          parentUser: null,
          side: "root",
          level: 0,
        },
      },
      { upsert: true }
    );

    if (res.upsertedCount === 1) rootUpserts++;
  }

  console.log(`✅ Root nodes ensured. Newly inserted: ${rootUpserts}`);

  // ---------------------------
  // Step 2: Plan placements for sponsor trees
  //   For each user X with sponsor S:
  //     TreeNode { treeOwner=S, user=X, parentUser=?, side=? }
  // ---------------------------
  const planned = [];
  const usedSlots = new Map(); // slotKey -> childUserId

  // Helper: check if candidateParent is valid within sponsor-scoped tree
  // In your new logic, a sponsor's tree contains ONLY users who used sponsor's code (direct referrals),
  // so parent must be either sponsor itself OR another direct referral of that sponsor.
  function parentIsValidWithinSponsorTree(sponsorIdStr, candidateParentIdStr) {
    if (!candidateParentIdStr) return false;
    if (candidateParentIdStr === sponsorIdStr) return true;

    const parent = userById.get(candidateParentIdStr);
    if (!parent) return false;

    return idStr(parent.referralUsed) === sponsorIdStr;
  }

  // Determine side by checking parent's leftChild/rightChild
  function inferSideFromParent(parent, childIdStr) {
    if (!parent) return null;
    if (idStr(parent.leftChild) === childIdStr) return "L";
    if (idStr(parent.rightChild) === childIdStr) return "R";
    return null;
  }

  // Pick a free side for (treeOwner, parentUser)
  function pickFreeSide(treeOwnerIdStr, parentUserIdStr) {
    const lKey = keySlot(treeOwnerIdStr, parentUserIdStr, "L");
    const rKey = keySlot(treeOwnerIdStr, parentUserIdStr, "R");
    if (!usedSlots.has(lKey)) return "L";
    if (!usedSlots.has(rKey)) return "R";
    return null;
  }

  let skippedNoSponsor = 0;

  for (const u of users) {
    const uid = idStr(u._id);
    const sponsorIdStr = idStr(u.referralUsed);

    if (!sponsorIdStr) {
      skippedNoSponsor++;
      continue; // no sponsor, no placement in someone else's tree
    }

    // candidate parent from old model
    const candidateParentIdStr = idStr(u.referredBy);

    let parentUserIdStr;

    // Use old parent ONLY if it fits sponsor scope; else fallback to sponsor
    if (parentIsValidWithinSponsorTree(sponsorIdStr, candidateParentIdStr)) {
      parentUserIdStr = candidateParentIdStr;
    } else {
      parentUserIdStr = sponsorIdStr;
    }

    const parentDoc = userById.get(parentUserIdStr);

    // First try to infer side from parent's old left/right pointers
    let side = inferSideFromParent(parentDoc, uid);

    // If inferred side collides, try the other side
    if (side) {
      const slotK = keySlot(sponsorIdStr, parentUserIdStr, side);
      if (usedSlots.has(slotK) && usedSlots.get(slotK) !== uid) {
        // collision: try opposite side
        const other = side === "L" ? "R" : "L";
        const otherK = keySlot(sponsorIdStr, parentUserIdStr, other);
        if (!usedSlots.has(otherK)) {
          side = other;
        } else {
          side = null;
        }
      }
    }

    // If still no side, auto-pick free
    if (!side) {
      side = pickFreeSide(sponsorIdStr, parentUserIdStr);
    }

    // If no slot is available under that parent in that sponsor tree, skip
    if (!side) {
      planned.push({
        action: "SKIP",
        reason: "No free slot under chosen parent in sponsor tree",
        treeOwner: sponsorIdStr,
        user: uid,
        parentUser: parentUserIdStr,
        side: null,
      });
      continue;
    }

    // Mark slot used (in planning stage) to avoid duplicate-slot errors
    usedSlots.set(keySlot(sponsorIdStr, parentUserIdStr, side), uid);

    planned.push({
      action: "PLACE",
      treeOwner: sponsorIdStr,
      user: uid,
      parentUser: parentUserIdStr,
      side,
    });
  }

  console.log(`✅ Planned placements: ${planned.filter(p => p.action === "PLACE").length}`);
  console.log(`ℹ️ Users skipped (no sponsor): ${skippedNoSponsor}`);
  console.log(`ℹ️ Planned skips (slot issues): ${planned.filter(p => p.action === "SKIP").length}`);

  // ---------------------------
  // Step 3: Compute levels per treeOwner (BFS from root=treeOwner)
  // ---------------------------
  const byTreeOwner = new Map(); // treeOwner -> placements
  for (const p of planned) {
    if (p.action !== "PLACE") continue;
    if (!byTreeOwner.has(p.treeOwner)) byTreeOwner.set(p.treeOwner, []);
    byTreeOwner.get(p.treeOwner).push(p);
  }

  const levelMap = new Map(); // `${treeOwner}:${user}` -> level

  for (const [treeOwnerIdStr, placements] of byTreeOwner.entries()) {
    // adjacency: parent -> children
    const childrenByParent = new Map();
    for (const p of placements) {
      const k = p.parentUser;
      if (!childrenByParent.has(k)) childrenByParent.set(k, []);
      childrenByParent.get(k).push(p.user);
    }

    // BFS
    const queue = [{ userId: treeOwnerIdStr, level: 0 }];
    const seen = new Set([treeOwnerIdStr]);

    while (queue.length) {
      const { userId, level } = queue.shift();
      const kids = childrenByParent.get(userId) || [];
      for (const childId of kids) {
        if (seen.has(childId)) continue;
        const childLevel = level + 1;
        levelMap.set(`${treeOwnerIdStr}:${childId}`, childLevel);
        seen.add(childId);
        queue.push({ userId: childId, level: childLevel });
      }
    }

    // Any node not reached (should be rare) => default level=1
    for (const p of placements) {
      const lk = `${treeOwnerIdStr}:${p.user}`;
      if (!levelMap.has(lk)) levelMap.set(lk, 1);
    }
  }

  // ---------------------------
  // Step 4: Apply TreeNode upserts + update user.placementCache
  // ---------------------------
  let treenodeUpserts = 0;
  let treenodeUpdates = 0;
  let placementCacheUpdates = 0;
  let applySkips = 0;

  for (const p of planned) {
    if (p.action !== "PLACE") {
      applySkips++;
      continue;
    }

    const treeOwnerObjId = new mongoose.Types.ObjectId(p.treeOwner);
    const userObjId = new mongoose.Types.ObjectId(p.user);
    const parentObjId = new mongoose.Types.ObjectId(p.parentUser);
    const level = levelMap.get(`${p.treeOwner}:${p.user}`) ?? 1;

    // Upsert TreeNode
    try {
      const res = await TreeNode.updateOne(
        { treeOwner: treeOwnerObjId, user: userObjId },
        {
          $set: {
            treeOwner: treeOwnerObjId,
            user: userObjId,
            parentUser: parentObjId,
            side: p.side,
            level,
          },
        },
        { upsert: true }
      );

      if (res.upsertedCount === 1) treenodeUpserts++;
      else if (res.matchedCount === 1) treenodeUpdates++;
    } catch (err) {
      // Unique slot collision or other issues
      console.error(
        `❌ TreeNode upsert failed for user=${p.user} in treeOwner=${p.treeOwner} parent=${p.parentUser} side=${p.side}`,
        err?.message || err
      );
      continue;
    }

    // Update placementCache on the user
    const cacheRes = await User.updateOne(
      { _id: userObjId },
      {
        $set: {
          placementCache: {
            treeOwner: treeOwnerObjId,
            parentUser: parentObjId,
            side: p.side,
            level,
          },
        },
      }
    );

    if (cacheRes.modifiedCount === 1) placementCacheUpdates++;
  }

  console.log("✅ Migration done");
  console.log(`   TreeNode inserted: ${treenodeUpserts}`);
  console.log(`   TreeNode updated : ${treenodeUpdates}`);
  console.log(`   placementCache updated: ${placementCacheUpdates}`);
  console.log(`   Skipped (slot/no place): ${applySkips}`);

  // Optional: show the skipped details
  const skipped = planned.filter((p) => p.action === "SKIP");
  if (skipped.length) {
    console.log("⚠️ Skipped placements detail:");
    for (const s of skipped) {
      console.log(
        `   - user=${s.user} treeOwner=${s.treeOwner} parent=${s.parentUser} reason=${s.reason}`
      );
    }
  }

  await mongoose.disconnect();
  console.log("✅ Disconnected");
}

main().catch(async (err) => {
  console.error("❌ Migration failed:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
