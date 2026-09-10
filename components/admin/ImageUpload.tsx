'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { Field } from './Field';
import { uploadClassImage } from '@/app/actions/uploads';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

type UploadResult = { ok: true; url: string } | { ok: false; error: string };

// Admin image picker: uploads to Supabase Storage via a server action and hands
// back the public URL. Shows a live preview with replace/remove controls.
//
// Built for class images and reused as is by the retreats panel: the action
// that receives the file, the frame the preview is shown in and the words
// under the picker are the only things that change between the two.
type Props = {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  helper?: string;
  /** The server action that stores the file. Defaults to the class-image bucket. */
  upload?: (formData: FormData) => Promise<UploadResult>;
  /** Tailwind aspect class for the preview and the empty frame — match the frame the site shows it in. */
  aspect?: string;
  /** The small line inside the empty frame ("JPG, PNG, WebP · max 5 MB"). */
  hint?: string;
  /** Alt text for the preview. */
  previewAlt?: string;
  /** Id for the hidden file input, so the field's label is bound to it. */
  inputId?: string;
};

export function ImageUpload({
  value,
  onChange,
  label = 'Image',
  helper = 'Shown on the public booking page. Optional — falls back to a default photo.',
  upload = uploadClassImage,
  aspect = 'aspect-[16/9]',
  hint = 'JPG, PNG, WebP · max 5 MB',
  previewAlt = 'Class',
  inputId,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError('Use a JPG, PNG, WebP or AVIF image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await upload(fd);
      if (res.ok) {
        onChange(res.url);
      } else {
        setError(
          res.error === 'too_large'
            ? 'Image must be 5 MB or smaller.'
            : res.error === 'bad_type'
            ? 'Use a JPG, PNG, WebP or AVIF image.'
            : 'Upload failed. Please try again.',
        );
      }
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset so selecting the same file again re-triggers change.
    e.target.value = '';
  }

  return (
    <Field label={label} helper={error ? undefined : helper} error={error ?? undefined} htmlFor={inputId}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ALLOWED.join(',')}
        onChange={onInputChange}
        className="hidden"
      />

      {value ? (
        <div className={`mt-2 relative w-full ${aspect} overflow-hidden border border-ink/10 bg-neutral-50 group`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={previewAlt} className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-ink/60" />
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-2 bg-gradient-to-t from-black/40 to-transparent">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="px-2.5 py-1 bg-white/90 text-ink font-body text-xs hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                onChange(null);
              }}
              disabled={uploading}
              aria-label="Remove image"
              className="px-2 py-1 bg-white/90 text-burgundy font-body text-xs hover:bg-white transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            >
              <X width={12} height={12} strokeWidth={2} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`mt-2 w-full ${aspect} flex flex-col items-center justify-center gap-2 border border-dashed border-ink/25 bg-neutral-50/50 text-ink/50 hover:border-ink/40 hover:text-ink/70 transition-colors cursor-pointer disabled:opacity-60`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="font-body text-xs">Uploading…</span>
            </>
          ) : (
            <>
              <ImagePlus width={22} height={22} strokeWidth={1.3} />
              <span className="font-body text-xs">Upload an image</span>
              <span className="font-body text-[10px] text-ink/40">{hint}</span>
            </>
          )}
        </button>
      )}
    </Field>
  );
}
