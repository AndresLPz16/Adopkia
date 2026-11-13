import { useEffect, useState } from "react";
import { rows, text } from "../shared";
import type { PortalDataRow } from "../shared";

// Fotos nuevas del formulario de mascota: enlaces, archivos, vistas previas
// y el límite de 10 fotos por mascota.
export function usePetPhotos(editingPet: string, visiblePets: PortalDataRow[]) {
  const [photoUrls, setPhotoUrls] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [filePhotoPreviews, setFilePhotoPreviews] = useState<
    { file: File; url: string }[]
  >([]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const [photoLimitError, setPhotoLimitError] = useState("");
  const existingPhotoCount = editingPet
    ? rows(visiblePets.find((pet) => text(pet.id) === editingPet)?.photos).length
    : 0;
  const photoUrlList = photoUrls
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
  const existingPetPhotos = editingPet
    ? rows(visiblePets.find((pet) => text(pet.id) === editingPet)?.photos)
    : [];
  const filePhotoEntries = photoFiles.map((file, index) => ({
    file,
    preview: filePhotoPreviews.find((item) => item.file === file)?.url ?? "",
    key: `${file.name}-${file.lastModified}-${index}`,
  }));

  useEffect(() => {
    const previews =
      typeof URL.createObjectURL === "function"
        ? photoFiles.map((file) => ({
            file,
            url: URL.createObjectURL(file),
          }))
        : [];
    setFilePhotoPreviews(previews);
    return () => {
      previews.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, [photoFiles]);

  const validatePhotoCount = (urls: string[], files: File[]) => {
    const newPhotoCount = urls.length + files.length;
    const exceedsLimit =
      newPhotoCount > 0 && existingPhotoCount + newPhotoCount > 10;
    setPhotoLimitError(
      exceedsLimit
        ? "No se pueden subir más de 10 fotos por mascota."
        : "",
    );
    return !exceedsLimit;
  };

  const clearPhotos = () => {
    setPhotoUrls("");
    setPhotoFiles([]);
    setPhotoLimitError("");
    setPhotoInputKey((key) => key + 1);
  };

  return {
    photoUrls,
    setPhotoUrls,
    photoFiles,
    setPhotoFiles,
    photoInputKey,
    setPhotoInputKey,
    photoLimitError,
    existingPhotoCount,
    existingPetPhotos,
    photoUrlList,
    filePhotoEntries,
    validatePhotoCount,
    clearPhotos,
  };
}

export type PetPhotos = ReturnType<typeof usePetPhotos>;
