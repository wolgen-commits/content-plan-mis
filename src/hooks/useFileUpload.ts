'use client';
import { useState } from 'react';

export function useFileUpload() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File, contentPlanId: string, fileType: 'design' | 'video') {
    setUploading(true);
    setProgress(0);

    const res = await fetch('/api/storage/signed-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_plan_id: contentPlanId,
        file_name: file.name,
        file_type: fileType,
        content_type: file.type,
      }),
    });

    if (!res.ok) throw new Error('Gagal mendapatkan signed URL');
    const { signed_url, public_url } = await res.json();

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error('Upload gagal')));
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.open('PUT', signed_url);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    setUploading(false);
    return { file_url: public_url, file_name: file.name, file_size: file.size };
  }

  return { upload, progress, uploading };
}
