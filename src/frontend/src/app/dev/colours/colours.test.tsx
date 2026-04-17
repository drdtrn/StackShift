import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColoursPage from "./page";

describe("ColoursPage — Design System Integration", () => {
  it("applies the 'light' class to the container when toggled", async () => {
    const user = userEvent.setup();
    render(<ColoursPage />);
    
    const wrapper = screen.getByTestId("theme-wrapper");
    const toggleBtn = screen.getByRole("button", { name: /Switch to Light/i });
    
    // Initial state
    expect(wrapper).toHaveClass("dark");
    
    await user.click(toggleBtn);
    
    // Toggled state
    expect(wrapper).toHaveClass("light");
    expect(screen.getByRole("button", { name: /Switch to Dark/i })).toBeInTheDocument();
  });

  it("renders typography with correct font classes", () => {
    render(<ColoursPage />);
    const monoText = screen.getByText(/System check complete/i).closest('p');
    expect(monoText).toHaveClass("font-mono");
  });
});
