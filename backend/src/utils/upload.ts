// backend/src/utils/upload.ts — Upload Cloudinary + Multer
// © 2024-2026 MaGestion Facile — M. Thierry ESSI
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import { Request } from 'express';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Multer en mémoire (pas de fichier sur disque)
export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowed = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Format non supporté. Accepté : JPEG, PNG, PDF'));
  },
});

// Upload un buffer vers Cloudinary
export async function uploadToCloudinary(
  buffer: Buffer,
  options: { folder: string; publicId?: string; resourceType?: 'image' | 'raw' }
): Promise<{ url: string; publicId: string; taille: number }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        `semenceep/${options.folder}`,
        public_id:     options.publicId,
        resource_type: options.resourceType || 'image',
        transformation: options.resourceType !== 'raw'
          ? [{ quality: 'auto', fetch_format: 'auto', width: 1200, crop: 'limit' }]
          : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result!.secure_url, publicId: result!.public_id, taille: result!.bytes });
      }
    );
    stream.end(buffer);
  });
}

// Supprimer un fichier Cloudinary
export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'raw' = 'image') {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error('[Cloudinary] Erreur suppression:', err);
  }
}

export { cloudinary };
