import mongoose from "mongoose";

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Usually, one user has one active KYC profile
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 're-upload_required'],
    default: 'pending'
  },
  // Added: To track which specific document type is being provided (e.g., Passport, DL)
  documentType: {
    type: String,
    required: true
  },
  kycFiles: [
    {
      fileType: { 
        type: String, 
        enum: ['image', 'video', 'pdf'], 
        required: true 
      },
      url: { type: String, required: true },
      cloudinaryId: { type: String, required: true }, // Essential for deleting/replacing files
      uploadedAt: { type: Date, default: Date.now }
    }
  ],
  adminNote: {
    type: String,
    default: ''
  },
  // Added: Track when the status last changed
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

export default mongoose.model("KYC", kycSchema);
