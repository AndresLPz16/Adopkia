import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { GroupIcon, SectionIcon } from "../ui/icons";
import { sidebarGroupDefinitions } from "./navigation";

export function PortalSidebar({
  section,
  visibleLinks,
  dynamicResources,
  visibleSectionNames,
  sidebarCopy,
  navTo,
}: {
  section: string;
  visibleLinks: string[];
  dynamicResources: { key: string; label: string }[];
  visibleSectionNames: Record<string, string>;
  sidebarCopy: { heading: string; title: string; description: string };
  navTo: (key: string) => void;
}) {
  const sidebarGroups = sidebarGroupDefinitions
    .map((group) => ({
      ...group,
      sections: group.sections.filter((key) => visibleLinks.includes(key)),
    }))
    .filter((group) => group.sections.length > 0);
  const visibleDynamicResources = dynamicResources.filter((resource) =>
    visibleLinks.includes(`resource:${resource.key}`),
  );
  if (visibleDynamicResources.length > 0) {
    sidebarGroups.push({
      key: "custom-resources",
      label: "Recursos",
      sections: visibleDynamicResources.map(
        (resource) => `resource:${resource.key}`,
      ),
    });
  }
  const [expandedSidebarGroup, setExpandedSidebarGroup] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    const activeGroup = sidebarGroups.find((group) =>
      group.sections.includes(section),
    );
    if (activeGroup) setExpandedSidebarGroup(activeGroup.key);
  }, [section]);
  const activeSidebarGroupKey =
    expandedSidebarGroup ??
    sidebarGroups.find((group) => group.sections.includes(section))?.key;

  // En pantallas angostas el menú empieza plegado para que el contenido se vea
  // sin desplazarse; en escritorio el botón no se muestra y el menú siempre
  // está visible (lo decide la hoja de estilos).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [section]);

  return (
    <aside className="app-sidebar">
      <p>{sidebarCopy.heading}</p>
      <button
        className="app-sidebar__mobile-toggle"
        type="button"
        aria-label={
          mobileMenuOpen
            ? "Cerrar menú de navegación"
            : "Abrir menú de navegación"
        }
        aria-expanded={mobileMenuOpen}
        aria-controls="portal-navigation"
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <span className="app-sidebar__mobile-toggle-icon" aria-hidden="true">
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </span>
        <span className="app-sidebar__mobile-toggle-text">
          <small>Menú</small>
          <strong>{visibleSectionNames[section] ?? "Permisos por rol"}</strong>
        </span>
      </button>
      <nav
        id="portal-navigation"
        aria-label="Navegación principal"
        data-mobile-open={mobileMenuOpen}
      >
        {sidebarGroups.map((group) => (
          <div
            className="app-sidebar__group"
            key={group.key}
            data-expanded={activeSidebarGroupKey === group.key}
            data-active={group.sections.includes(section)}
          >
            <button
              className="app-sidebar__group-toggle"
              type="button"
              aria-label={group.label}
              aria-expanded={activeSidebarGroupKey === group.key}
              aria-controls={`sidebar-group-${group.key}`}
              onClick={() =>
                setExpandedSidebarGroup((current) =>
                  (current ?? activeSidebarGroupKey) === group.key ? null : group.key,
                )
              }
            >
              <span className="app-sidebar__group-icon" aria-hidden="true">
                <GroupIcon name={group.key} />
              </span>
              <span className="app-sidebar__group-label">{group.label}</span>
              <span className="app-sidebar__group-count" aria-hidden="true">
                {group.sections.length}
              </span>
              <span className="app-sidebar__group-chevron" aria-hidden="true">
                <ChevronDown size={16} />
              </span>
            </button>
            <div
              className="app-sidebar__group-links"
              id={`sidebar-group-${group.key}`}
            >
              {group.sections.map((key) => (
                <button
                  key={key}
                  className={`app-sidebar__link ${section === key ? "app-sidebar__link--active" : ""}`}
                  type="button"
                  aria-current={section === key ? "page" : undefined}
                  onClick={() => navTo(key)}
                >
                  <span aria-hidden="true">
                    <SectionIcon name={key} size={16} />
                  </span>
                  {visibleSectionNames[key] ?? "Permisos por rol"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="app-sidebar__note"><strong>{sidebarCopy.title}</strong><span>{sidebarCopy.description}</span></div>
    </aside>
  );
}
