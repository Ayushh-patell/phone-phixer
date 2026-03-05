import { useMemo } from "react";

export default function ImageModal({ images = [], open, setOpen }) {

  // Decide column count
  const cols = useMemo(() => {
    if (images.length === 2) return 2;
    if (images.length >= 3) return 3;
    return 1;
  }, [images.length]);

  const itemWidth = `${100 / cols}%`;

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="close-btn" onClick={() => setOpen(false)}>
          ×
        </button>

        <div className="image-flex">
          {images.map((src, i) => (
            <div
              key={i}
              className="img-wrapper"
              style={{ flexBasis: itemWidth }}
            >
              <a href="#contactSection" onClick={() => setOpen(false)}>
                <img src={src} alt="" />
              </a>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.4);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .modal {
          background: white;
          display: block;
          border-radius: 8px;
          padding: 16px;
          width: 90%;
          height:auto;
          max-width: 900px;
          max-height: 85dvh;
          overflow-y: auto;
          position: relative;
        }

        .close-btn {
          position: absolute;
          top: 8px;
          right: 10px;
          border: none;
          background: none;
          font-size: 22px;
          cursor: pointer;
        }

        .image-flex {
          display: flex;
          flex-wrap: wrap;
        }

        .img-wrapper {
          flex-grow: 0;
          flex-shrink: 0;
          padding: 0px 10px;
          box-sizing: border-box;
        }

        .img-wrapper img {
          width: 100%;
          display: block;
          border-radius: 4px;
          object-fit: cover;
        }
      `}</style>
    </div>
  );
}
