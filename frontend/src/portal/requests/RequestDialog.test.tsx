import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RequestDialog } from "./RequestDialog";

describe("request details dialog", () => {
  it("keeps all form answers available in the scrollable detail", () => {
    function TestDialog() {
      const openerRef = useRef<HTMLButtonElement | null>(null);
      const closeRef = useRef<HTMLButtonElement | null>(null);

      return (
        <RequestDialog
          selectedRequest={{
            id: 12,
            pet_name: "Luna",
            applicant_name: "Camila",
            status: "pendiente",
            requested_at: "2026-10-30T23:52:00Z",
            answers: [
              { question: 1, question_prompt: "Pregunta inicial", value: "Respuesta inicial" },
              { question: 2, question_prompt: "Pregunta final", value: "Respuesta final" },
            ],
          }}
          setSelectedRequest={() => {}}
          requestOpenerRef={openerRef}
          requestDialogCloseRef={closeRef}
          pets={[]}
          questions={[]}
        />
      );
    }

    render(<TestDialog />);

    expect(screen.getByText("Respuesta inicial")).toBeInTheDocument();
    expect(screen.getByText("Respuesta final")).toBeInTheDocument();
  });
});
