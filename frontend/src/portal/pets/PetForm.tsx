import { Field, text } from "../shared";
import type { PortalDataRow, PortalPetSaver, PortalSubmit } from "../shared";
import type { PetPhotos } from "./usePetPhotos";

export function PetForm({
  form,
  setForm,
  setValue,
  submit,
  savePet,
  editingPet,
  setEditingPet,
  managedShelters,
  breeds,
  busy,
  photos,
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  setValue: (name: string, value: string) => void;
  submit: PortalSubmit;
  savePet: PortalPetSaver;
  editingPet: string;
  setEditingPet: (value: string) => void;
  managedShelters: PortalDataRow[];
  breeds: PortalDataRow[];
  busy: boolean;
  photos: PetPhotos;
}) {
  const {
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
  } = photos;

  return (
    <form
      className="portal-form"
      onSubmit={submit(async () => {
        if (!validatePhotoCount(photoUrlList, photoFiles)) return;
        const payload = {
          shelter: Number(form.shelter),
          breed: Number(form.breed),
          name: form.name,
          approximate_birth_date: form.approximate_birth_date || null,
          size: form.size,
          health: form.health || null,
          temperament: form.temperament || null,
        };
        const endpoint = editingPet
          ? `/api/v1/pets/${editingPet}/`
          : "/api/v1/pets/";
        const saved = await savePet(
          endpoint,
          editingPet ? "PUT" : "POST",
          payload,
          photoUrlList,
          photoFiles,
        );
        if (saved) clearPhotos();
      })}
    >
      <h2>{editingPet ? "Editar mascota" : "Publicar mascota"}</h2>
      <section className="portal-form-section" aria-labelledby="pet-basic-info-title">
        <div className="portal-form-section__heading">
          <h3 id="pet-basic-info-title">Información básica</h3>
          <p>Identifica a la mascota y el refugio responsable.</p>
        </div>
        <div className="portal-form-section__fields">
          <Field label="Nombre" name="name" value={form.name ?? ""} onChange={setValue} required />
          <Field label="Refugio" name="shelter" value={form.shelter ?? ""} onChange={setValue} required options={managedShelters.map((item) => ({ value: text(item.id), label: text(item.name) }))} />
          <Field label="Raza" name="breed" value={form.breed ?? ""} onChange={setValue} required options={breeds.map((item) => ({ value: text(item.id), label: `${text(item.name)}${item.species_name ? ` · ${text(item.species_name)}` : ""}` }))} />
          <Field label="Tamaño" name="size" value={form.size ?? ""} onChange={setValue} required options={[{ value: "pequeno", label: "Pequeño" }, { value: "mediano", label: "Mediano" }, { value: "grande", label: "Grande" }]} />
        </div>
      </section>
      <section className="portal-form-section" aria-labelledby="pet-care-info-title">
        <div className="portal-form-section__heading">
          <h3 id="pet-care-info-title">Salud y personalidad</h3>
          <p>Comparte información útil para encontrarle un hogar adecuado.</p>
        </div>
        <div className="portal-form-section__fields">
          <Field label="Fecha aproximada de nacimiento" name="approximate_birth_date" type="date" value={form.approximate_birth_date ?? ""} onChange={setValue} />
          <Field label="Temperamento" name="temperament" value={form.temperament ?? ""} onChange={setValue} />
          <Field label="Salud" name="health" value={form.health ?? ""} onChange={setValue} multiline />
        </div>
      </section>
      <section className="portal-form-section" aria-labelledby="pet-photos-title">
        <div className="portal-form-section__heading">
          <h3 id="pet-photos-title">Fotos</h3>
          <p>
            Agrega enlaces o imágenes. Puedes incluir hasta 10 fotos en total
            {existingPhotoCount > 0 ? `; esta mascota ya tiene ${existingPhotoCount}.` : "."}
          </p>
        </div>
        {existingPetPhotos.length > 0 && (
          <div className="portal-photo-previews" aria-label="Fotos actuales">
            {existingPetPhotos.map((photo) => (
              <figure className="portal-photo-preview" key={text(photo.id) || text(photo.url)}>
                <img src={text(photo.url)} alt="Foto actual de la mascota" />
                <figcaption>Foto actual</figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="portal-form-section__fields">
          <label className="portal-field portal-form-section__wide-field">
            <span>Enlaces de fotos (uno por línea)</span>
            <textarea
              value={photoUrls}
              onChange={(event) => {
                const nextUrls = event.target.value;
                setPhotoUrls(nextUrls);
                validatePhotoCount(
                  nextUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
                  photoFiles,
                );
              }}
              placeholder="https://ejemplo.com/foto.jpg"
            />
          </label>
          <label className="portal-field portal-form-section__wide-field">
            <span>O selecciona fotos desde tu dispositivo</span>
            <input
              key={photoInputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={(event) => {
                const nextFiles = Array.from(event.target.files ?? []);
                setPhotoFiles(nextFiles);
                validatePhotoCount(photoUrlList, nextFiles);
              }}
            />
          </label>
        </div>
        {(photoUrlList.length > 0 || filePhotoEntries.length > 0) && (
          <div className="portal-photo-previews" aria-label="Vista previa de fotos seleccionadas">
            {photoUrlList.map((url, index) => (
              <figure className="portal-photo-preview" key={`${url}-${index}`}>
                <img src={url} alt={`Vista previa de foto ${index + 1}`} />
                <figcaption>Enlace {index + 1}</figcaption>
              </figure>
            ))}
            {filePhotoEntries.map(({ file, preview, key }, index) => (
              <figure className="portal-photo-preview" key={key}>
                {preview ? (
                  <img src={preview} alt={`Vista previa de ${file.name}`} />
                ) : (
                  <span className="portal-photo-preview__file" aria-hidden="true">▧</span>
                )}
                <figcaption>{file.name}</figcaption>
                <button
                  type="button"
                  className="portal-link portal-link--danger"
                  aria-label={`Quitar ${file.name}`}
                  onClick={() => {
                    const nextFiles = photoFiles.filter((_, fileIndex) => fileIndex !== index);
                    setPhotoFiles(nextFiles);
                    setPhotoInputKey((keyValue) => keyValue + 1);
                    validatePhotoCount(photoUrlList, nextFiles);
                  }}
                >
                  Quitar
                </button>
              </figure>
            ))}
          </div>
        )}
      </section>
      {photoLimitError && <p className="portal-alert portal-alert--error" role="alert">{photoLimitError}</p>}
      <div className="portal-form__actions">
        <button className="portal-button" disabled={busy}>{busy ? "Guardando…" : editingPet ? "Guardar cambios" : "Publicar mascota"}</button>
        {editingPet && <button className="portal-button portal-button--secondary" type="button" onClick={() => { setEditingPet(""); setForm({}); clearPhotos(); }}>Cancelar edición</button>}
      </div>
    </form>
  );
}
