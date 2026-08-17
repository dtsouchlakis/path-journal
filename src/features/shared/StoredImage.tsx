import { useEffect, useRef, useState } from 'react';
import { journalRepository } from '../../data/journalRepository';

type StoredImageProps = {
  imageId?: string;
  legacySource?: string;
  alt: string;
  className?: string;
  deferUntilVisible?: boolean;
};

export function StoredImage({ imageId, legacySource, alt, className, deferUntilVisible = false }: StoredImageProps) {
  const container = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(!deferUntilVisible);
  const [source, setSource] = useState(legacySource ?? '');

  useEffect(() => {
    if (!deferUntilVisible || !container.current || !('IntersectionObserver' in window)) {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: '650px 0px' },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [deferUntilVisible]);

  useEffect(() => {
    if (!nearViewport || !imageId) {
      setSource(nearViewport ? legacySource ?? '' : '');
      return;
    }
    let disposed = false;
    let objectUrl = '';
    void journalRepository.loadImage(imageId).then((blob) => {
      if (!blob || disposed) return;
      objectUrl = URL.createObjectURL(blob);
      setSource(objectUrl);
    });
    return () => {
      // Blob URLs retain the underlying bytes. Revocation when a card moves far
      // from the viewport gives Android permission to reclaim that memory.
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId, legacySource, nearViewport]);

  return (
    <div className={className} ref={container}>
      {source ? <img src={source} alt={alt} decoding="async" /> : <span className="image-placeholder" aria-hidden="true" />}
    </div>
  );
}
