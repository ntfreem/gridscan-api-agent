/**
 * Phase 6B: legacy paths redirect to the Spec 012 admin app; the URL fragment that carries
 * reset tokens survives the redirect; the retired React widget shows a notice (W2).
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { KeepHashRedirect, RetiredChatNotice, NotFoundPage } from "../../App";

function Where() {
  const l = useLocation();
  return <p data-testid="where">{l.pathname + l.hash}</p>;
}

test("the reset link fragment is kept when redirecting to the admin app", () => {
  render(
    <MemoryRouter initialEntries={["/reset-password#token=abc123"]}>
      <Routes>
        <Route path="/reset-password" element={<KeepHashRedirect to="/app/reset-password" />} />
        <Route path="/app/reset-password" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  expect(screen.getByTestId("where")).toHaveTextContent("/app/reset-password#token=abc123");
});

test("the retired chat widget explains itself instead of rendering a blank page", () => {
  render(<RetiredChatNotice />);
  expect(screen.getByRole("status")).toHaveTextContent("This chat window has moved");
  expect(screen.getByRole("heading", { name: "This chat window has moved" })).toBeInTheDocument();
});

test("unknown paths show a not-found page with a way home", () => {
  render(<NotFoundPage />);
  expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
});
