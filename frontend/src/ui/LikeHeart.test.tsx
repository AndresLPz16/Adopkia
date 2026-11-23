import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LikeHeart } from "./LikeHeart";

describe("LikeHeart", () => {
  it("does not animate a heart that was already liked when it appears", () => {
    const { container } = render(<LikeHeart liked size={20} />);

    expect(container.querySelector(".like-heart--on")).toBeInTheDocument();
    expect(container.querySelector(".like-heart--pop")).not.toBeInTheDocument();
    expect(container.querySelector(".like-heart__burst")).not.toBeInTheDocument();
  });

  it("bursts when it becomes liked and shrinks when it is unliked", () => {
    const { container, rerender } = render(<LikeHeart liked={false} size={20} />);

    rerender(<LikeHeart liked size={20} />);
    expect(container.querySelector(".like-heart--pop")).toBeInTheDocument();
    expect(container.querySelectorAll(".like-heart__spark")).toHaveLength(6);

    rerender(<LikeHeart liked={false} size={20} />);
    expect(container.querySelector(".like-heart--release")).toBeInTheDocument();
    expect(container.querySelector(".like-heart__burst")).not.toBeInTheDocument();
  });
});
