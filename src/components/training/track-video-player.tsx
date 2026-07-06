import { PlayCircle } from "lucide-react";
import { normalizeVideoEmbedUrl } from "@/lib/training/video-embed";
import type { TrainingTrackVideo } from "@/types/training";

export function TrackVideoPlayer({ video }: { video: TrainingTrackVideo }) {
  const embedUrl = normalizeVideoEmbedUrl(video.embedUrl);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-black">
      {embedUrl ? (
        <div className="aspect-video">
          <iframe
            src={embedUrl}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <PlayCircle size={40} className="text-blue-500" />
          <p className="mt-3 text-base font-black text-slate-900">{video.title}</p>
          <p className="mt-4 rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Видео скоро появится
          </p>
        </div>
      )}
    </div>
  );
}
