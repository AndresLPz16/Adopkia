import type { Dispatch, SetStateAction } from "react";
import { RolePermissionsPanel } from "../rbac";
import type { AuthUser } from "../rbac/types";
import { NotificationsSection, ProfileSection } from "./AccountSections";
import {
  AdoptionsSection,
  MessagesSection,
  RecordsSection,
  VaccineCatalogSection,
  VeterinariansSection,
} from "./CareSections";
import { SheltersSection, UsersSection } from "./ManagementSections";
import { roleNames } from "./navigation";
import { DashboardSection, StatisticsSection } from "./OverviewSections";
import { PetsSection, RequestsSection } from "./PetSections";
import type {
  PermissionCheck,
  PortalDataRow,
  PortalPetSaver,
  PortalSender,
  PortalSubmit,
} from "./shared";

type StringMap = Record<string, string>;
type DynamicResource = { key: string; label: string };

export type SectionContentProps = {
  section: string;
  dynamicResourceKey: string;
  dynamicResources: DynamicResource[];
  setDynamicResources: Dispatch<SetStateAction<DynamicResource[]>>;
  setCustomSectionNames: Dispatch<SetStateAction<StringMap>>;
  data: Record<string, unknown>;
  user: AuthUser;
  role: string;
  isAdmin: boolean;
  isPlatformSuperadmin: boolean;
  canDo: PermissionCheck;
  visibleLinks: string[];
  visibleSectionNames: StringMap;
  navTo: (key: string) => void;
  // Datos cargados
  pets: PortalDataRow[];
  managedPets: PortalDataRow[];
  visiblePets: PortalDataRow[];
  shelters: PortalDataRow[];
  managedShelters: PortalDataRow[];
  breeds: PortalDataRow[];
  questions: PortalDataRow[];
  requests: PortalDataRow[];
  adoptions: PortalDataRow[];
  followUps: PortalDataRow[];
  reminders: PortalDataRow[];
  conversations: PortalDataRow[];
  messages: PortalDataRow[];
  records: PortalDataRow[];
  vaccines: PortalDataRow[];
  species: PortalDataRow[];
  veterinarians: PortalDataRow[];
  members: PortalDataRow[];
  notifications: PortalDataRow[];
  users: PortalDataRow[];
  availableRoleRows: PortalDataRow[];
  profile: PortalDataRow | undefined;
  // Estado de formularios compartido entre secciones
  form: StringMap;
  setForm: Dispatch<SetStateAction<StringMap>>;
  setValue: (name: string, value: string) => void;
  answers: StringMap;
  setAnswers: Dispatch<SetStateAction<StringMap>>;
  selectedConversation: string;
  setSelectedConversation: Dispatch<SetStateAction<string>>;
  editingPet: string;
  setEditingPet: Dispatch<SetStateAction<string>>;
  editingShelter: string;
  setEditingShelter: Dispatch<SetStateAction<string>>;
  editingUser: string;
  setEditingUser: Dispatch<SetStateAction<string>>;
  petSearch: string;
  setPetSearch: Dispatch<SetStateAction<string>>;
  requestedPetId: string;
  setRequestedPetId: Dispatch<SetStateAction<string>>;
  // Acciones
  submit: PortalSubmit;
  send: PortalSender;
  savePet: PortalPetSaver;
  setError: (value: string) => void;
  busy: boolean;
  loading: boolean;
};

// Elige y renderiza la sección activa del portal.
export function SectionContent({
  section,
  dynamicResourceKey,
  dynamicResources,
  setDynamicResources,
  setCustomSectionNames,
  data,
  user,
  role,
  isAdmin,
  isPlatformSuperadmin,
  canDo,
  visibleLinks,
  visibleSectionNames,
  navTo,
  pets,
  managedPets,
  visiblePets,
  shelters,
  managedShelters,
  breeds,
  questions,
  requests,
  adoptions,
  followUps,
  reminders,
  conversations,
  messages,
  records,
  vaccines,
  species,
  veterinarians,
  members,
  notifications,
  users,
  availableRoleRows,
  profile,
  form,
  setForm,
  setValue,
  answers,
  setAnswers,
  selectedConversation,
  setSelectedConversation,
  editingPet,
  setEditingPet,
  editingShelter,
  setEditingShelter,
  editingUser,
  setEditingUser,
  petSearch,
  setPetSearch,
  requestedPetId,
  setRequestedPetId,
  submit,
  send,
  savePet,
  setError,
  busy,
  loading,
}: SectionContentProps) {
  const stats = data["/api/v1/statistics/adoptions/"] as PortalDataRow | undefined;
  const activeDynamicResource = dynamicResources.find(
    (resource) => resource.key === dynamicResourceKey,
  );
  const content = activeDynamicResource
    ? (
      <section className="portal-section" aria-labelledby="dynamic-resource-title">
        <p className="portal-eyebrow">Recurso RBAC</p>
        <h1 id="dynamic-resource-title">{activeDynamicResource.label}</h1>
        <p>
          Este recurso ya está disponible en la matriz de permisos. Su vista y
          funcionalidad específica todavía deben implementarse.
        </p>
      </section>
    )
    : section === "permissions"
    ? (
      <RolePermissionsPanel
        onSidebarLabelsChange={setCustomSectionNames}
        onResourcesChange={setDynamicResources}
      />
    )
    : section === "dashboard"
      ? <DashboardSection
          userName={user.name}
          role={role}
          roleName={roleNames[role] ?? ""}
          isAdmin={isAdmin}
          shelters={shelters}
          pets={pets}
          managedPets={managedPets}
          records={records}
          vaccines={vaccines}
          requests={requests}
          adoptions={adoptions}
          notifications={notifications}
          stats={stats}
          visibleLinks={visibleLinks}
          sectionNames={visibleSectionNames}
          navTo={navTo}
        />
      : section === "pets"
          ? <PetsSection
              role={role}
              canDo={canDo}
              visiblePets={visiblePets}
              managedShelters={managedShelters}
              breeds={breeds}
              form={form}
              setValue={setValue}
              submit={submit}
              savePet={savePet}
              send={send}
              setForm={setForm}
              editingPet={editingPet}
              setEditingPet={setEditingPet}
              busy={busy}
              loading={loading}
              petSearch={petSearch}
              setPetSearch={setPetSearch}
              onRequestAdoption={(petId) => {
                setRequestedPetId(petId);
                navTo("requests");
              }}
            />
          : section === "requests"
            ? <RequestsSection
                role={role}
                isPlatformSuperadmin={isPlatformSuperadmin}
                canDo={canDo}
                questions={questions}
                pets={pets}
                requests={requests}
                requestedPetId={requestedPetId}
                onRequestSubmitted={() => setRequestedPetId("")}
                form={form}
                answers={answers}
                setAnswers={setAnswers}
                setValue={setValue}
                submit={submit}
                send={send}
                setError={setError}
                loading={loading}
                busy={busy}
              />
          : section === "adoptions"
            ? <AdoptionsSection
                role={role}
                isPlatformSuperadmin={isPlatformSuperadmin}
                canDo={canDo}
                adoptions={adoptions}
                followUps={followUps}
                reminders={reminders}
                vaccines={vaccines}
                form={form}
                setValue={setValue}
                submit={submit}
                send={send}
                loading={loading}
                busy={busy}
              />
            : section === "messages"
              ? <MessagesSection
                  role={role}
                  isPlatformSuperadmin={isPlatformSuperadmin}
                  canDo={canDo}
                  userId={user.id}
                  pets={pets}
                  conversations={conversations}
                  messages={messages}
                  selectedConversation={selectedConversation}
                  setSelectedConversation={setSelectedConversation}
                  form={form}
                  setValue={setValue}
                  submit={submit}
                  send={send}
                  setError={setError}
                  loading={loading}
                  busy={busy}
                />
              : section === "records"
                ? <RecordsSection
                    role={role}
                      isPlatformSuperadmin={isPlatformSuperadmin}
                      canDo={canDo}
                    userId={user.id}
                    pets={pets}
                    records={records}
                    vaccines={vaccines}
                    veterinarians={veterinarians}
                    form={form}
                    setValue={setValue}
                    submit={submit}
                    send={send}
                    loading={loading}
                    busy={busy}
                  />
                : section === "veterinarians"
                  ? <VeterinariansSection veterinarians={veterinarians} loading={loading} />
                    : section === "vaccines"
                      ? <VaccineCatalogSection
                          vaccines={vaccines}
                          species={species}
                          canDo={canDo}
                          send={send}
                          loading={loading}
                          busy={busy}
                        />
                : section === "shelters"
                  ? <SheltersSection
                      role={role}
                      userId={user.id}
                      canDo={canDo}
                      shelters={shelters}
                      members={members}
                      form={form}
                      setForm={setForm}
                      setValue={setValue}
                      submit={submit}
                      send={send}
                      editingShelter={editingShelter}
                      setEditingShelter={setEditingShelter}
                      loading={loading}
                      busy={busy}
                    />
                  : section === "notifications"
                    ? <NotificationsSection
                        notifications={notifications}
                        loading={loading}
                        send={send}
                        isPlatformSuperadmin={isPlatformSuperadmin}
                      />
                    : section === "profile"
                      ? <ProfileSection
                          profile={profile}
                          role={role}
                          roleName={roleNames[role] ?? role}
                          form={form}
                          setValue={setValue}
                          submit={submit}
                          send={send}
                          busy={busy}
                        />
                      : section === "users"
                        ? <UsersSection
                            userId={user.id}
                            isPlatformSuperadmin={isPlatformSuperadmin}
                            canDo={canDo}
                            users={users}
                            availableRoleRows={availableRoleRows}
                            form={form}
                            setForm={setForm}
                            setValue={setValue}
                            submit={submit}
                            send={send}
                            editingUser={editingUser}
                            setEditingUser={setEditingUser}
                            roleNames={roleNames}
                            loading={loading}
                            busy={busy}
                            setError={setError}
                          />
                      : section === "statistics"
                        ? <StatisticsSection stats={stats} />
                        : <DashboardSection
                            userName={user.name}
                            role={role}
                            roleName={roleNames[role] ?? ""}
                            isAdmin={isAdmin}
                            shelters={shelters}
                            pets={pets}
                            managedPets={managedPets}
                            records={records}
                            vaccines={vaccines}
                            requests={requests}
                            adoptions={adoptions}
                            notifications={notifications}
                            stats={stats}
                            visibleLinks={visibleLinks}
                            sectionNames={visibleSectionNames}
                            navTo={navTo}
                          />;

  return content;
}
