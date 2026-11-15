import { useState } from "react";
import { endpointsAffectedBy } from "./navigation";
import { ApiError, apiErrorMessage, responseData } from "./shared";
import type {
  FieldErrors,
  PortalDataRow,
  PortalPetSaver,
  PortalPhotoSaver,
  PortalRequest,
} from "./shared";
import type { PortalReload } from "./usePortalData";

/** Lo que una acción hace con los formularios de la sección al terminar. */
export type PortalFormReset = {
  /** Tras guardar: vacía el formulario y cierra cualquier edición abierta. */
  afterSave: () => void;
  /** Tras guardar una mascota: vacía su formulario y cierra su edición. */
  afterPetSave: () => void;
  /** La mascota se guardó pero sus fotos no: se deja abierta para reintentar. */
  keepEditingPet: (petId: string) => void;
};

/**
 * Acciones que escriben en la API: guardar formularios, mascotas con sus
 * fotos, la foto de perfil y las notificaciones leídas. Cada una avisa del
 * resultado y recarga solo las listas que cambió.
 */
export function usePortalActions({
  request,
  reload,
  setError,
  setNotice,
  forms,
}: {
  request: PortalRequest;
  reload: PortalReload;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  forms: PortalFormReset;
}) {
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Foto de perfil cambiada en esta visita; `undefined` = la que llegó al entrar.
  const [changedPhotoUrl, setChangedPhotoUrl] = useState<string | null | undefined>(undefined);

  const clearFieldErrors = () => setFieldErrors({});

  // Al corregir un campo se quita su error; los demás siguen marcados.
  const clearFieldError = (name: string) => {
    setFieldErrors((current) => {
      if (!(name in current)) return current;
      const rest = { ...current };
      delete rest[name];
      return rest;
    });
  };

  // Un error de validación se muestra junto a su campo cuando ese campo está
  // en pantalla; lo que no tiene campo visible va al aviso general.
  const reportFailure = (caught: unknown, fallback: string) => {
    if (!(caught instanceof ApiError)) {
      setError(caught instanceof Error ? caught.message : fallback);
      return;
    }
    const inline: FieldErrors = {};
    const general: Record<string, unknown> = {};
    const responseFields =
      caught.data && typeof caught.data === "object" && !Array.isArray(caught.data)
        ? (caught.data as Record<string, unknown>)
        : {};
    const fieldErrorsFound = caught.fieldErrors;
    for (const [field, value] of Object.entries(responseFields)) {
      const hasControl =
        field in fieldErrorsFound &&
        /^[\w-]+$/.test(field) &&
        document.querySelector(`.app-content .portal-field [name="${field}"]`) !== null;
      if (hasControl) inline[field] = fieldErrorsFound[field];
      else general[field] = value;
    }
    if (Object.keys(inline).length === 0) {
      setError(caught.message);
      return;
    }
    setFieldErrors(inline);
    setError(
      Object.keys(general).length > 0
        ? apiErrorMessage(general, caught.status)
        : "Revisa los campos marcados.",
    );
    // Lleva el foco al primer campo con error una vez pintado.
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>('.app-content .portal-field [aria-invalid="true"]')
        ?.focus();
    }, 0);
  };

  const send = async (
    endpoint: string,
    method: string,
    body?: unknown,
    successMessage = "Cambios guardados correctamente.",
  ): Promise<boolean> => {
    setBusy(true);
    setError("");
    setNotice("");
    setFieldErrors({});
    try {
      const response = await request(endpoint, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      await responseData(response);
      setNotice(successMessage);
      forms.afterSave();
      await reload(endpointsAffectedBy(endpoint));
      return true;
    } catch (caught) {
      reportFailure(caught, "No se pudo completar la acción.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Marca varias notificaciones en paralelo y recarga la lista una sola vez,
  // sin tocar el formulario que el usuario pueda tener a medio escribir.
  const markNotificationsRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const outcomes = await Promise.allSettled(
        ids.map(async (id) =>
          responseData(
            await request(`/api/v1/notifications/${encodeURIComponent(id)}/`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ is_read: true }),
            }),
          ),
        ),
      );
      const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
      await reload(["/api/v1/notifications/"]);
      if (failed > 0) {
        setError(
          `No se pudieron marcar ${failed} de ${ids.length} notificaciones como leídas.`,
        );
      } else {
        setNotice("Todas las notificaciones fueron marcadas como leídas.");
      }
    } finally {
      setBusy(false);
    }
  };

  const savePet: PortalPetSaver = async (
    endpoint,
    method,
    body,
    photoUrls,
    photoFiles,
  ) => {
    setBusy(true);
    setError("");
    setNotice("");
    setFieldErrors({});
    let petWasSaved = false;
    let petId = "";
    let uploadedPhotos = 0;
    const totalPhotos = photoUrls.length + photoFiles.length;
    try {
      const petResponse = await request(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const petData = await responseData(petResponse);
      petWasSaved = true;
      if (
        petData &&
        typeof petData === "object" &&
        "id" in petData &&
        (typeof petData.id === "number" || typeof petData.id === "string")
      ) {
        petId = String(petData.id);
      }

      if (totalPhotos > 0 && !petId) {
        throw new Error("No se pudo identificar la mascota para asociar sus fotos.");
      }

      const uploadPhoto = async (formData: FormData) => {
        formData.append("pet", petId);
        const response = await request("/api/v1/pet-photos/", {
          method: "POST",
          body: formData,
        });
        await responseData(response);
        uploadedPhotos += 1;
      };

      for (const url of photoUrls) {
        const formData = new FormData();
        formData.append("url", url);
        await uploadPhoto(formData);
      }
      for (const file of photoFiles) {
        const formData = new FormData();
        formData.append("image", file);
        await uploadPhoto(formData);
      }

      setNotice(
        totalPhotos > 0
          ? `Perfil de mascota guardado con ${totalPhotos} ${totalPhotos === 1 ? "foto" : "fotos"}.`
          : "Perfil de mascota guardado.",
      );
      forms.afterPetSave();
      await reload(endpointsAffectedBy(endpoint));
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la publicación de la mascota.";
      if (petWasSaved) {
        forms.keepEditingPet(petId);
        await reload(endpointsAffectedBy(endpoint));
        setError(
          uploadedPhotos > 0
            ? `La mascota se guardó, pero solo se pudieron guardar ${uploadedPhotos} de ${totalPhotos} fotos. ${message}`
            : `La mascota se guardó, pero no se pudieron guardar sus fotos. ${message}`,
        );
      } else {
        reportFailure(caught, message);
      }
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePhoto: PortalPhotoSaver = async (file) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      let body: FormData | undefined;
      if (file) {
        body = new FormData();
        body.append("image", file);
      }
      const response = await request("/api/v1/auth/me/photo/", {
        method: file ? "POST" : "DELETE",
        body,
      });
      const saved = (await responseData(response)) as PortalDataRow | null;
      const savedUrl = saved?.photo_url;
      setChangedPhotoUrl(typeof savedUrl === "string" && savedUrl ? savedUrl : null);
      setNotice(file ? "Foto de perfil actualizada." : "Foto de perfil eliminada.");
      await reload(["/api/v1/auth/me/"]);
      return true;
    } catch (caught) {
      // El error de validación viene en el campo "image"; se muestra tal cual.
      const message =
        caught instanceof ApiError && caught.fieldErrors.image
          ? caught.fieldErrors.image.join(" ")
          : caught instanceof Error
            ? caught.message
            : "No se pudo cambiar la foto de perfil.";
      setError(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return {
    busy,
    fieldErrors,
    clearFieldError,
    clearFieldErrors,
    changedPhotoUrl,
    send,
    markNotificationsRead,
    savePet,
    savePhoto,
  };
}
