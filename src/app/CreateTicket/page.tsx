"use client";

import CreateTicket from "../../components/CreateTicket/CreateTicket";

export default function CreatePage() {
  return (
    <main style={{
      width: "100%",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "24px",
      padding: "32px"
    }}>
      <h1 style={{ fontSize: "30px", fontWeight: "bold" }}>
        Create Ticket
      </h1>

      <CreateTicket />
    </main>
  );
}