import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessagesSection } from "./CareSections";

describe("MessagesSection", () => {
  it("shows received messages and sends a reply in the selected conversation", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const submit = (callback: () => Promise<void>) => (event: React.FormEvent) => {
      event.preventDefault();
      void callback();
    };

    render(
      <MessagesSection
        role="adoptante"
        canDo={() => true}
        userId={1}
        pets={[]}
        conversations={[
          {
            id: 4,
            shelter_name: "Huellas",
            pet_name: "Luna",
          },
        ]}
        messages={[
          {
            id: 9,
            sender: 2,
            sender_name: "Refugio Huellas",
            content: "Puedes visitarnos mañana.",
            sent_at: "2026-10-30",
            is_read: true,
          },
        ]}
        selectedConversation="4"
        setSelectedConversation={() => undefined}
        form={{ content: "Gracias, allí estaré." }}
        setValue={() => undefined}
        submit={submit}
        send={send}
        setError={() => undefined}
        loading={false}
        onRefresh={() => undefined}
        busy={false}
      />,
    );

    expect(screen.getByText("Puedes visitarnos mañana.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(
        "/api/v1/messages/",
        "POST",
        { conversation: 4, content: "Gracias, allí estaré." },
        "Mensaje enviado.",
      ),
    );
  });
});
