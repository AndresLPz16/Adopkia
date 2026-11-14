import {
  Bell,
  Building2,
  ChartColumn,
  CircleUserRound,
  ClipboardList,
  FolderOpen,
  Heart,
  House,
  KeyRound,
  LayoutGrid,
  Mail,
  PawPrint,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

// Un solo juego de iconos para todo el sitio. Los iconos son decorativos: el
// texto que los acompaña es el que nombra cada control.
const sectionIcons: Record<string, LucideIcon> = {
  dashboard: House,
  pets: PawPrint,
  requests: ClipboardList,
  adoptions: Heart,
  messages: Mail,
  records: Stethoscope,
  veterinarians: Stethoscope,
  vaccines: Syringe,
  shelters: Building2,
  notifications: Bell,
  profile: CircleUserRound,
  statistics: ChartColumn,
  users: Users,
  permissions: KeyRound,
};

const groupIcons: Record<string, LucideIcon> = {
  home: House,
  adoption: Heart,
  care: Stethoscope,
  management: Settings2,
  account: CircleUserRound,
  "custom-resources": FolderOpen,
};

const roleIcons: Record<string, LucideIcon> = {
  adoptante: PawPrint,
  refugio: Building2,
  veterinario: Stethoscope,
  administrador: ShieldCheck,
};

const baseProps: LucideProps = { size: 18, strokeWidth: 2, "aria-hidden": true };

/** Icono de una sección del portal (menú lateral y accesos del panel). */
export function SectionIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = sectionIcons[name] ?? LayoutGrid;
  return <Icon {...baseProps} {...props} />;
}

/** Icono de un grupo del menú lateral. */
export function GroupIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = groupIcons[name] ?? LayoutGrid;
  return <Icon {...baseProps} {...props} />;
}

/** Icono que representa el rol de la persona en el panel de inicio. */
export function RoleIcon({ role, ...props }: { role: string } & LucideProps) {
  const Icon = roleIcons[role] ?? ShieldCheck;
  return <Icon {...baseProps} {...props} />;
}
