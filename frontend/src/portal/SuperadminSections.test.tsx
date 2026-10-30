import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationsSection } from "./AccountSections";
import {
  AdoptionsSection,
  MessagesSection,
} from "./CareSections";
import { RequestsSection } from "./PetSections";

describe("superadmin content views", () => {
  it("shows adoption form answers to the superadmin using question prompts", () => {
    render(
      <RequestsSection
        role="administrador"
        isPlatformSuperadmin
        canDo={() => false}
        questions={[{ id: 8, prompt: "¿Tienes experiencia con mascotas?" }]}
        pets={[]}
        requests={[
          {
            id: 12,
            pet: 5,
            pet_name: "Luna",
            applicant_name: "Ana",
            status: "pendiente",
            requested_at: "2026-03-15T13:45:00Z",
            pet_details: {
              id: 5,
              name: "Luna",
              species: "Perro",
              breed_name: "Criolla",
              city: "Riohacha",
              health: "Vacunada y saludable.",
              photos: [{ id: 6, url: "/luna.jpg", is_primary: true }],
            },
            answers: [{ question: 8, value: "Sí, tuve dos perros." }],
          },
        ]}
        form={{}}
        answers={{}}
        setAnswers={vi.fn()}
        setValue={vi.fn()}
        submit={() => () => {}}
        send={vi.fn(async () => {})}
        setError={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    expect(
      screen.queryByText(/¿Tienes experiencia con mascotas/),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Ver solicitud completa" }),
    );

    expect(
      screen.getByRole("dialog", { name: /Luna · Ana/ }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("Foto de Luna")).toHaveAttribute(
      "src",
      "/luna.jpg",
    );
    expect(screen.getByText("Perro · Criolla · Riohacha")).toBeInTheDocument();
    expect(screen.getByText(/Vacunada y saludable/)).toBeInTheDocument();
    expect(
      screen.getByText(/¿Tienes experiencia con mascotas/),
    ).toBeInTheDocument();
    expect(screen.getByText("Sí, tuve dos perros.")).toBeInTheDocument();
    const requestDate = screen.getByText(/marzo de 2026/i);
    expect(requestDate).toBeInTheDocument();
    expect(requestDate.closest("time")).toHaveAttribute(
      "datetime",
      "2026-03-15T13:45:00Z",
    );
    expect(
      screen.getByText("Fecha de solicitud").parentElement,
    ).toHaveClass("portal-request-dialog__date");

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar detalles de la solicitud" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows adoption return details and the content of care follow-ups", () => {
    render(
      <AdoptionsSection
        role="administrador"
        isPlatformSuperadmin
        canDo={() => false}
        adoptions={[
          {
            id: 4,
            pet_name: "Milo",
            applicant: "Carlos",
            adoption_date: "2026-01-03",
            status: "devuelta",
            return_date: "2026-02-01",
            return_reason: "La familia se mudó.",
          },
        ]}
        followUps={[
          {
            id: 7,
            adoption: 4,
            date: "2026-01-20",
            wellbeing: "bueno",
            observations: "Se adaptó bien a su nuevo hogar.",
          },
        ]}
        reminders={[]}
        vaccines={[]}
        form={{}}
        setValue={vi.fn()}
        submit={() => () => {}}
        send={vi.fn(async () => {})}
        loading={false}
        busy={false}
      />,
    );

    expect(screen.getByText("Motivo de devolución:")).toBeInTheDocument();
    expect(screen.getByText("La familia se mudó.")).toBeInTheDocument();
    expect(screen.getByText("Seguimiento de Milo")).toBeInTheDocument();
    expect(screen.getByText("Se adaptó bien a su nuevo hogar.")).toBeInTheDocument();
  });

  it("shows message contents without exposing the message composer", () => {
    render(
      <MessagesSection
        role="administrador"
        isPlatformSuperadmin
        canDo={() => true}
        userId={1}
        pets={[]}
        conversations={[
          {
            id: 3,
            adopter_name: "Ana",
            shelter_name: "Huellas",
            pet_name: "Luna",
          },
        ]}
        messages={[
          {
            id: 5,
            sender: 2,
            sender_name: "Ana",
            content: "¿Cómo está Luna?",
            sent_at: "2026-02-10",
            is_read: true,
          },
        ]}
        selectedConversation="3"
        setSelectedConversation={vi.fn()}
        form={{}}
        setValue={vi.fn()}
        submit={() => () => {}}
        send={vi.fn(async () => {})}
        setError={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    expect(screen.getByText("¿Cómo está Luna?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  });

  it("shows only the notification content loaded for the superadmin account", () => {
    render(
      <NotificationsSection
        isPlatformSuperadmin
        notifications={[
          {
            id: 9,
            message: "Tienes una nueva notificación.",
            notification_type: "sistema",
            sent_at: "2026-02-10",
            is_read: true,
          },
        ]}
        loading={false}
        send={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText("Tienes una nueva notificación.")).toBeInTheDocument();
    expect(
      screen.getByText(/notificaciones dirigidas a tu cuenta de superadministrador/i),
    ).toBeInTheDocument();
  });
});
