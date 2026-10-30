import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestsSection } from "./PetSections";

describe("RequestsSection", () => {
  it("shows shelter answers and decision buttons for a pending request", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const submit = (callback: () => Promise<void>) => (event: React.FormEvent) => {
      event.preventDefault();
      void callback();
    };

    render(
      <RequestsSection
        role="refugio"
        canDo={() => true}
        questions={[]}
        pets={[]}
        requests={[
          {
            id: 21,
            pet_name: "Luna",
            applicant_name: "Ana",
            requested_at: "2026-10-30",
            status: "Pendiente",
            answers: [
              {
                question: 1,
                question_prompt: "¿Por qué quieres adoptar?",
                value: "Quiero darle un hogar.",
              },
            ],
          },
        ]}
        form={{}}
        answers={{}}
        setAnswers={() => undefined}
        setValue={() => undefined}
        submit={submit}
        send={send}
        setError={() => undefined}
        loading={false}
        onRefresh={() => undefined}
        busy={false}
      />,
    );

    expect(
      screen.getByText("¿Por qué quieres adoptar?", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByText("Quiero darle un hogar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    fireEvent.click(screen.getByRole("button", { name: "Denegar" }));

    await waitFor(() => {
      expect(send).toHaveBeenNthCalledWith(
        1,
        "/api/v1/adoption-requests/21/approve/",
        "POST",
        { message: "" },
        "Solicitud aprobada.",
      );
      expect(send).toHaveBeenNthCalledWith(
        2,
        "/api/v1/adoption-requests/21/reject/",
        "POST",
        { message: "" },
        "Solicitud rechazada.",
      );
    });
  });
});
