"use client";

import { useState, useCallback, useRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Cropper, { type Area } from "react-easy-crop";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { UploadCloud, ImageIcon, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslations } from "next-intl"; // neu
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/toast";

export function ProfileImageUploader() {
  const { data: session, refresh } = useAuth();
  const { push } = useToast();
  const t = useTranslations("ProfilePage"); // neu: Namespace für Profiltexte / Bild-Upload

  // --- STATES ---
  const [isOpen, setIsOpen] = useState(false); // NEU: State für Dialog-Offenheit
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarFallback =
    session?.user?.name?.trim().slice(0, 2).toUpperCase() || t("upload.fallbackInitials");

  // --- HILFSFUNKTION: Zustände zurücksetzen ---
  const resetImageState = () => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    // setUploading(false); // Optional, sollte aber in diesem Kontext bereits false sein
  };

  // --- DIALOG ÖFFNEN/SCHLIESSEN HANDLER ---
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    // WICHTIG: Wenn der Dialog geschlossen wird (open === false) UND
    // ein Bild geladen ist (imageSrc), setze die Zustände zurück.
    if (!open && imageSrc) {
      resetImageState();
    }
  };

  // --- DRAG & DROP ---
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      const MAX_SIZE_MB = 3;

      if (!allowed.includes(file.type)) {
        push({ variant: "error", description: t("upload.onlyTypes") }); // lokalisiert
        return;
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        push({
          variant: "error",
          description: t("upload.maxSize", { max: MAX_SIZE_MB }),
        }); // lokalisiert
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [t, push]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // --- CROP CALLBACK / CROPPING TO BLOB / UPLOAD HANDLER ---
  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  async function cropToBlob(imageSrc: string, cropPixels: Area): Promise<Blob> {
    const image = document.createElement("img");
    image.src = imageSrc;
    image.alt = "";

    await new Promise((resolve) => {
      image.onload = resolve;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;

    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    );

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.95)
    );

    return blob;
  }

  const handleUpload = async () => {
    if (!imageSrc || !croppedAreaPixels) return;

    setUploading(true);
    const croppedBlob = await cropToBlob(imageSrc, croppedAreaPixels);
    const filename = "profile.jpg";

    const formData = new FormData();
    formData.append("image", croppedBlob, filename);

    const res = await fetch("/api/profile/update-image", {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    setUploading(false);

    if (!res.ok) {
      push({
        variant: "error",
        description: t("upload.error"),
      });
      return;
    }

    await refresh();

    push({ variant: "success", description: t("upload.success") });
    resetImageState();
    setIsOpen(false);
    window.location.reload();
  };

  return (
    // State-Steuerung zur Dialog-Komponente hinzufügen
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Avatar className="w-[50px] h-[50px]">
          <AvatarImage
            src={session?.user?.image || "/default-profile.png"}
            alt={session?.user?.name || t("upload.avatarAlt")}
            width={50}
            height={50}
            className="rounded-full cursor-pointer border shadow"
          />
          <AvatarFallback>{avatarFallback}</AvatarFallback>
        </Avatar>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("upload.title")}</DialogTitle> {/* lokalisiert */}
        </DialogHeader>

        {/* --- Drag & Drop Area --- */}
        {!imageSrc && (
          <div
            {...getRootProps()}
            className={`
              h-48 border-2 border-dashed flex flex-col items-center justify-center rounded-lg transition 
              cursor-pointer p-4 space-y-2
              ${
                isDragActive
                  ? "bg-info/12 border-info text-info-foreground"
                  : "bg-muted/35 border-border hover:bg-muted/55"
              }
            `}
            onClick={() => inputRef.current?.click()}
          >
            <input {...getInputProps()} ref={inputRef} className="hidden" />

            {/* Icon basierend auf Zustand */}
            {isDragActive ? (
              <UploadCloud className="w-8 h-8 animate-pulse text-primary" />
            ) : (
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            )}

            <p className="text-center font-semibold text-foreground">
              {isDragActive ? t("upload.dragActive") : t("upload.dragIdle")}
            </p>

            <p className="text-center text-xs text-muted-foreground">
              {t.rich("upload.hint", {
                types: "PNG, JPG, JPEG, WEBP",
                max: 3,
              })}
            </p>
          </div>
        )}

        {/* --- CROP UI --- */}
        {imageSrc && (
          <>
            <div className="relative w-full h-64 bg-[var(--terminal-bg)] rounded-md overflow-hidden">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                cropShape="round"
                cropSize={{ width: 220, height: 220 }}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom Slider */}
            <div className="mt-4">
              <label className="text-sm font-medium flex items-center gap-2 mb-2">
                <div className="flex justify-between items-center w-full">
                  <ZoomOut className="w-4 h-4 text-muted-foreground" />
                  <p className="flex-grow text-center">{t("upload.zoom")}</p>
                  <ZoomIn className="w-4 h-4 text-muted-foreground" />
                </div>
              </label>
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.1}
                onValueChange={(v) => setZoom(v[0])}
              />
            </div>

            {/* Save button */}
            <Button
              className="mt-4 w-full"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? t("upload.uploading") : t("upload.saveButton")}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
