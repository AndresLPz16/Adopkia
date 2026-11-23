import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdoptionStories } from "./AdoptionStories";
import { LandingMarquee } from "./LandingMarquee";
import { adoptionStories } from "./storiesData";

describe("adoption stories", () => {
  it("labels every example story so it is not read as a real testimonial", () => {
    render(<AdoptionStories />);

    const list = screen.getByRole("list");
    const stories = within(list).getAllByRole("listitem");
    expect(stories).toHaveLength(adoptionStories.length);
    adoptionStories.forEach((story, index) => {
      expect(within(stories[index]).getByRole("heading", { name: story.petName })).toBeInTheDocument();
      if (story.example) {
        expect(within(stories[index]).getByText("Historia de ejemplo")).toBeInTheDocument();
      }
    });
  });
});

describe("landing marquee", () => {
  it("is hidden from screen readers because it repeats what the page says", () => {
    const { container } = render(<LandingMarquee />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
