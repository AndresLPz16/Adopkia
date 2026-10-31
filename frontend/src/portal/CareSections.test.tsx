import type { FormEvent } from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdoptionsSection, MessagesSection } from "./CareSections";

const submitForm = (callback: () => Promise<void>) => (event: FormEvent) => {
  event.preventDefault();
  void callback();
};

function makeAdoptionsProps(overrides: Record<string, unknown> = {}) {
  return {
    role: "refugio",
    isPlatformSuperadmin: false,
    canDo: () => true,
    adoptions: [
      {
        id: 21,
        pet_name: "Luna",
        applicant: "Ana",
        adoption_date: "2026-10-10",
        status: "Activa",
      },
    ],
    followUps: [],
    reminders: [],
    vaccines: [],
    form: {},
    setValue: vi.fn(),
    submit: submitForm,
    send: vi.fn().mockResolvedValue(true),
    loading: false,
    busy: false,
    ...overrides,
  };
}

describe("adoption follow-ups and returns", () => {
  it("shows a separate observation form for each active adoption and saves it", async () => {
    const send = vi.fn().mockResolvedValue(true);
    render(
      <AdoptionsSection
        {...makeAdoptionsProps({
          adoptions: [
            {
              id: 21,
              pet_name: "Luna",
              applicant: "Ana",
              adoption_date: "2026-10-10",
              status: "Activa",
            },
            {
              id: 22,
              pet_name: "Toby",
              applicant: "Luis",
              adoption_date: "2026-10-11",
              status: "Activa",
            },
          ],
          send,
        })}
      />,
    );

    const lunaForm = screen.getByRole("form", {
      name: "Registrar seguimiento de la adopción 21",
    });
    const tobyForm = screen.getByRole("form", {
      name: "Registrar seguimiento de la adopción 22",
    });
    const observations = screen.getAllByLabelText(
      "Observaciones del seguimiento",
    );
    fireEvent.change(observations[0], {
      target: { value: "Come bien y está activa." },
    });
    expect(observations[1]).toHaveValue("");
    fireEvent.change(
      within(lunaForm).getByLabelText("Fecha del seguimiento"),
      { target: { value: "2026-10-30" } },
    );

    fireEvent.submit(lunaForm);
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/follow-ups/",
        "POST",
        {
          adoption: 21,
          date: "2026-10-30",
          wellbeing: "bueno",
          observations: "Come bien y está activa.",
        },
        "Seguimiento registrado.",
      ),
    );
    expect(tobyForm).toBeInTheDocument();
  });

  it("shows the return button for a localized active status and submits the reason", async () => {
    const send = vi.fn().mockResolvedValue(true);
    render(<AdoptionsSection {...makeAdoptionsProps({ send })} />);

    fireEvent.click(screen.getByRole("button", { name: "Registrar devolución" }));
    const returnForm = screen.getByRole("form", {
      name: "Registrar devolución de la adopción 21",
    });
    fireEvent.change(
      within(returnForm).getByLabelText("Motivo de la devolución"),
      { target: { value: "La familia se traslada." } },
    );
    fireEvent.change(
      within(returnForm).getByLabelText("Fecha de devolución"),
      { target: { value: "2026-10-30" } },
    );
    fireEvent.submit(returnForm);

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/adoptions/21/return/",
        "POST",
        {
          reason: "La familia se traslada.",
          return_date: "2026-10-30",
        },
        "Devolución registrada.",
      ),
    );
  });
});

describe("messages", () => {
  it("sends a message to the selected conversation", async () => {
    const send = vi.fn().mockResolvedValue(true);
    render(
      <MessagesSection
        role="adoptante"
        isPlatformSuperadmin={false}
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
        messages={[]}
        selectedConversation="3"
        setSelectedConversation={vi.fn()}
        form={{ content: "¿Puedo conocer a Luna?" }}
        setValue={vi.fn()}
        submit={(callback) => (event) => {
          event.preventDefault();
          void callback();
        }}
        send={send}
        setError={vi.fn()}
        loading={false}
        busy={false}
      />,
    );

    fireEvent.submit(
      screen.getByLabelText("Escribe un mensaje").closest("form")!,
    );

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/messages/",
        "POST",
        { conversation: 3, content: "¿Puedo conocer a Luna?" },
        "Mensaje enviado.",
      ),
    );
  });
});
