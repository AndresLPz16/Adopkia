import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileSection } from "./AccountSections";
import { PortalHeader } from "./PortalHeader";

function renderProfile(profile: Record<string, unknown>) {
  const savePhoto = vi.fn(async () => true);
  const setError = vi.fn();
  render(
    <ProfileSection
      profile={{ name: "Ana María Foto", email: "ana@example.com", ...profile }}
      role="adoptante"
      roleName="Adoptante"
      form={{}}
      setValue={vi.fn()}
      submit={(callback) => (event) => {
        event.preventDefault();
        void callback();
      }}
      send={vi.fn(async () => true)}
      savePhoto={savePhoto}
      setError={setError}
      busy={false}
    />,
  );
  return { savePhoto, setError };
}

const file = (name: string, type: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type });

describe("profile photo", () => {
  it("shows the initials and uploads the chosen image", async () => {
    const { savePhoto, setError } = renderProfile({});

    expect(screen.getByText("AF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir foto" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar foto" })).not.toBeInTheDocument();

    const photo = file("yo.png", "image/png");
    fireEvent.change(screen.getByLabelText("Archivo de la foto de perfil"), {
      target: { files: [photo] },
    });

    await waitFor(() => expect(savePhoto).toHaveBeenCalledWith(photo));
    expect(setError).not.toHaveBeenCalled();
  });

  it("rejects other file types and oversized images before uploading", () => {
    const { savePhoto, setError } = renderProfile({});
    const input = screen.getByLabelText("Archivo de la foto de perfil");

    fireEvent.change(input, { target: { files: [file("doc.pdf", "application/pdf")] } });
    expect(setError).toHaveBeenLastCalledWith("Usa una imagen JPG, PNG o WEBP.");

    fireEvent.change(input, {
      target: { files: [file("grande.jpg", "image/jpeg", 5 * 1024 * 1024 + 1)] },
    });
    expect(setError).toHaveBeenLastCalledWith("La imagen no puede superar 5 MB.");
    expect(savePhoto).not.toHaveBeenCalled();
  });

  it("shows the current photo and removes it after confirming", async () => {
    const { savePhoto } = renderProfile({ photo_url: "/media/avatars/abc.png" });

    expect(document.querySelector(".profile-photo img")).toHaveAttribute(
      "src",
      "/media/avatars/abc.png",
    );
    expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
    expect(savePhoto).not.toHaveBeenCalled();
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Quitar foto" }),
    );

    await waitFor(() => expect(savePhoto).toHaveBeenCalledWith(null));
  });

  it("shows the photo next to the name in the header", () => {
    render(
      <PortalHeader
        role="adoptante"
        user={{ name: "Ana María Foto", photoUrl: "/media/avatars/abc.png" }}
        notifications={[]}
        canDo={() => false}
        send={vi.fn(async () => true)}
        onMarkAllRead={vi.fn(async () => undefined)}
        navTo={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    expect(document.querySelector(".app-header__identity img")).toHaveAttribute(
      "src",
      "/media/avatars/abc.png",
    );
  });
});
