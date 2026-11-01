import { ShieldCheck } from "lucide-react";
import "./AdminBadge.css";

export default function AdminBadge() {
  return (
    <span className="adminBadge" title="Pokétip administrator">
      <ShieldCheck aria-hidden="true" /> Admin
    </span>
  );
}
