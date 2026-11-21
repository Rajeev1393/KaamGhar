"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { LoadingLine } from "@/components/DashboardParts";
import { api } from "@/lib/api";
import type { AdminRole, Worker } from "@/lib/types";
import { managementTabs, type ManagementTab } from "./navigation";

export type Location = { _id: string; name: string; parent: string | null; active: boolean };
type Admin = { _id: string; name: string; email: string; active: boolean; adminRole?: AdminRole; adminCity?: string };
type RoleDefinition = { id: AdminRole; name: string; permissions: string[] };
type Log = { _id: string; actor: string; method: string; route: string; target: string[]; status: number; createdAt: string };
type Settings = { timeZone: string };
type SectionProps = { refresh: number; notify: (message: string) => void };
type Save = (path: string, method: "POST" | "PATCH", body: object) => Promise<boolean>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function SectionData<T>({ path, refresh, notify, children }: SectionProps & {
  path: string;
  children: (data: T, save: Save, saving: boolean) => ReactNode;
}) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const key = `${path}:${refresh}:${revision}`;

  useEffect(() => {
    const controller = new AbortController();
    api<T>(`admin/${path}`, { signal: controller.signal })
      .then((data) => setResult({ key, data }))
      .catch((error) => {
        if (!controller.signal.aborted) setResult({ key, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [key, path]);

  async function save(endpoint: string, method: "POST" | "PATCH", body: object) {
    setSaving(true);
    setSaveError("");
    try {
      await api(`admin/${endpoint}`, { method, body: JSON.stringify(body) });
      setRevision((value) => value + 1);
      notify("Changes saved.");
      return true;
    } catch (error) {
      setSaveError(errorMessage(error));
      return false;
    } finally {
      setSaving(false);
    }
  }

  if (result?.key !== key) return <LoadingLine />;
  if (result.error) return <p className="inline-error" role="alert">{result.error}</p>;
  return <>
    {saveError && <p className="inline-error" role="alert">{saveError}</p>}
    {result.data && children(result.data, save, saving)}
  </>;
}

function LocationRow({ location, editable, saving, save, parentActive = true }: {
  location: Location; editable: boolean; saving: boolean; save: Save; parentActive?: boolean;
}) {
  return <form className="admin-management-row" onSubmit={(event) => {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    void save(`locations/${location._id}`, "PATCH", { name });
  }}>
    {editable ? <label>Name<input name="name" defaultValue={location.name} required maxLength={100} /></label> : <strong>{location.name}</strong>}
    <span>{location.active ? (parentActive ? "Active" : "Inactive because state is disabled") : "Inactive"}</span>
    {editable && <>
      <button className="button button-outline" disabled={saving}>Save name</button>
      <button className="button button-outline" type="button" disabled={saving} onClick={() => {
        void save(`locations/${location._id}`, "PATCH", { active: !location.active });
      }}>{location.active ? "Disable" : "Enable"}</button>
    </>}
  </form>;
}

function Locations({ editable, ...props }: SectionProps & { editable: boolean }) {
  return <SectionData<{ locations: Location[] }> path="locations" {...props}>{({ locations }, save, saving) => {
    const states = locations.filter((location) => location.parent === null);
    function add(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void save("locations", "POST", { name: data.get("name"), parent: data.get("parent") || null });
    }
    return <>
      {editable && <div className="admin-management-forms">
        <form className="admin-management-form" onSubmit={add}>
          <h3>Add a state</h3>
          <label>State name<input name="name" required maxLength={100} /></label>
          <button className="button button-dark" disabled={saving}>Add state</button>
        </form>
        {states.length > 0 && <form className="admin-management-form" onSubmit={add}>
          <h3>Add a city</h3>
          <label>State<select name="parent" required>{states.map((state) => <option key={state._id} value={state._id}>{state.name}</option>)}</select></label>
          <label>City name<input name="name" required maxLength={100} /></label>
          <button className="button button-dark" disabled={saving}>Add city</button>
        </form>}
      </div>}
      {states.length === 0 && <p>No states have been added.</p>}
      {states.map((state) => {
        const cities = locations.filter((location) => location.parent === state._id);
        return <section className="admin-management-group" key={state._id}>
          <h3>{state.name}</h3>
          <LocationRow location={state} editable={editable} saving={saving} save={save} />
          <h4>Cities</h4>
          {cities.length === 0 && <p>No cities in this state.</p>}
          {cities.map((city) => <LocationRow key={city._id} location={city} parentActive={state.active} editable={editable} saving={saving} save={save} />)}
        </section>;
      })}
    </>;
  }}</SectionData>;
}

type CityOption = { id: string; label: string };

export function activeCityOptions(locations: Location[]): CityOption[] {
  const states = new Map(locations.filter(({ parent, active }) => parent === null && active).map(({ _id, name }) => [_id, name]));
  return locations.flatMap(({ _id, name, parent, active }) => {
    const state = parent && states.get(parent);
    return active && state ? [{ id: _id, label: `${name}, ${state}` }] : [];
  });
}

function CityOptions({ cities }: { cities: CityOption[] }) {
  return cities.map(({ id, label }) => <option key={id} value={id}>{label}</option>);
}

function EmployeeRoleFields({ roles, cities, employee }: { roles: RoleDefinition[]; cities: CityOption[]; employee?: Admin }) {
  const [selectedRole, setSelectedRole] = useState(employee?.adminRole ?? "operations");
  const selected = roles.find(({ id }) => id === selectedRole);
  const city = cities.find(({ id }) => id === employee?.adminCity);
  return <div className="admin-employee-permissions">
    <label>Employee role<select name="adminRole" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as AdminRole)}>
      {roles.filter(({ id }) => id !== "locations" || employee?.adminRole === id).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
    </select></label>
    {selectedRole === "city-manager" && <label>Assigned city
      <select name="adminCity" required defaultValue={city?.id ?? ""}>
        <option value="">{cities.length ? "Select a city" : "Add an active city in Locations & Cities"}</option>
        <CityOptions cities={cities} />
      </select>
    </label>}
    {selected && <small>Access: {selected.permissions.join(" ? ")}</small>}
  </div>;
}

function roleFields(form: FormData) {
  return { adminRole: form.get("adminRole"), adminCity: form.get("adminCity") };
}

function AdminUsers({ showCreate, setShowCreate, ...props }: SectionProps & {
  showCreate: boolean; setShowCreate: (show: boolean) => void;
}) {
  return <SectionData<{ admins: Admin[]; roles: RoleDefinition[]; locations: Location[]; currentAdminId: string }> path="admin-users" {...props}>
    {({ admins, roles, locations, currentAdminId }, save, saving) => {
      const cities = activeCityOptions(locations);
      return <>
        {!showCreate && <button className="button button-dark" onClick={() => setShowCreate(true)}>Create Employee</button>}
        {showCreate && <form className="admin-management-form" onSubmit={async (event) => {
          event.preventDefault();
          const created = await save("admin-users", "POST", Object.fromEntries(new FormData(event.currentTarget)));
          if (created) setShowCreate(false);
        }}>
          <h3>Create Employee</h3>
          <label>Name<input name="name" autoComplete="off" maxLength={80} required /></label>
          <label>Email<input name="email" type="email" autoComplete="off" maxLength={254} required /></label>
          <label>Phone<input name="phone" type="tel" maxLength={20} required /></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
          <EmployeeRoleFields roles={roles} cities={cities} />
          <div className="admin-management-row">
            <button className="button button-dark" disabled={saving}>Create Employee</button>
            <button className="button button-outline" type="button" disabled={saving} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>}
        <div className="admin-management-group">
          {admins.map((admin) => {
            const protectedAccount = !admin.adminRole || admin.adminRole === "owner" || admin._id === currentAdminId;
            const roleName = roles.find(({ id }) => id === admin.adminRole)?.name ?? "Super Admin";
            return <form className="admin-management-row" key={admin._id} onSubmit={(event) => {
              event.preventDefault();
              if (!protectedAccount) void save(`admin-users/${admin._id}`, "PATCH", roleFields(new FormData(event.currentTarget)));
            }}>
              <div className="admin-management-identity"><strong>{admin.name}</strong><span>{admin.email}</span></div>
              <span>{admin.active ? "Active" : "Disabled"}</span>
              {protectedAccount ? <span>{roleName}</span> : <>
                <EmployeeRoleFields roles={roles} cities={cities} employee={admin} />
                <button className="button button-outline" disabled={saving}>Save permissions</button>
                <button className="button button-outline" type="button" disabled={saving} onClick={() => {
                  void save(`admin-users/${admin._id}`, "PATCH", { active: !admin.active });
                }}>{admin.active ? "Disable" : "Enable"}</button>
              </>}
            </form>;
          })}
        </div>
      </>;
    }}
  </SectionData>;
}

export function ProfessionalCityAssignment({ worker, cities, notify }: {
  worker: Worker; cities: CityOption[]; notify: SectionProps["notify"];
}) {
  const [cityId, setCityId] = useState(worker.adminCity ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <form className="admin-management admin-management-row" onSubmit={async (event) => {
    event.preventDefault();
    const nextCityId = String(new FormData(event.currentTarget).get("cityId") ?? "");
    setSaving(true);
    setError("");
    try {
      await api(`admin/professionals/${worker._id}/city`, {
        method: "PATCH", body: JSON.stringify({ cityId: nextCityId || null }),
      });
      setCityId(nextCityId);
      notify("City assignment saved.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }}>
    <label>City manager assignment<select key={cityId} name="cityId" defaultValue={cityId} disabled={saving}>
      <option value="">Unassigned</option>
      {cityId && !cities.some(({ id }) => id === cityId) && <option value={cityId} disabled>Inactive city</option>}
      <CityOptions cities={cities} />
    </select></label>
    <button className="button button-outline" disabled={saving}>Save city</button>
    {error && <span role="alert">{error}</span>}
  </form>;
}

function Roles({ role, ...props }: SectionProps & { role: AdminRole }) {
  return <SectionData<{ roles: RoleDefinition[] }> path="roles" {...props}>{({ roles }) =>
    <div className="admin-management-forms">{roles.map((definition) => <article className="admin-management-group" key={definition.id}>
      <h3>{definition.name}{(role === definition.id || (role === "owner" && definition.id === "super-admin")) && " (your role)"}</h3>
      <ul>{definition.permissions.map((permission) => <li key={permission}>{permission}</li>)}</ul>
    </article>)}</div>
  }</SectionData>;
}

function AuditLogs(props: SectionProps) {
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.at(-1);
  const path = cursor ? `audit-logs?before=${encodeURIComponent(cursor)}` : "audit-logs";
  return <SectionData<Settings & { logs: Log[]; next: string | null }> path={path} {...props}>{({ logs, next, timeZone }) => {
    const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone });
    return <>
      <p>Times shown in {timeZone}.</p>
      {logs.length === 0 && <p>No admin changes recorded.</p>}
      {logs.length > 0 && <div className="admin-management-table"><table>
        <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Record</th><th>HTTP status</th></tr></thead>
        <tbody>{logs.map((log) => <tr key={log._id}>
          <td>{date.format(new Date(log.createdAt))}</td><td>{log.actor}</td>
          <td>{log.method} {log.route}</td><td>{log.target.join(", ") || "—"}</td><td>{log.status}</td>
        </tr>)}</tbody>
      </table></div>}
      <div className="admin-management-row">
        <button className="button button-outline" disabled={!cursor} onClick={() => setCursors(cursors.slice(0, -1))}>Newer</button>
        <button className="button button-outline" disabled={!next} onClick={() => { if (next) setCursors([...cursors, next]); }}>Older</button>
      </div>
    </>;
  }}</SectionData>;
}

function AdminSettings(props: SectionProps) {
  return <SectionData<Settings> path="settings" {...props}>{({ timeZone }, save, saving) => {
    const zones = [...new Set([timeZone, "Asia/Kolkata", "UTC", ...Intl.supportedValuesOf("timeZone")])];
    return <form className="admin-management-form" onSubmit={(event) => {
      event.preventDefault();
      void save("settings", "PATCH", { timeZone: new FormData(event.currentTarget).get("timeZone") });
    }}>
      <label>Display time zone<select name="timeZone" defaultValue={timeZone}>
        {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
      </select></label>
      <p>Local time: {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date())}</p>
      <button className="button button-dark" disabled={saving}>Save settings</button>
    </form>;
  }}</SectionData>;
}

export default function AdminManagement({
  tab, role, canEditLocations, showCreateEmployee, onToggleCreateEmployee, onCreateEmployee, ...props
}: SectionProps & {
  tab: ManagementTab;
  role: AdminRole;
  canEditLocations: boolean;
  showCreateEmployee: boolean;
  onToggleCreateEmployee: (show: boolean) => void;
  onCreateEmployee?: () => void;
}) {
  return <section className="dash-panel admin-management">
    <div className="panel-heading">
      <h2>{managementTabs.find(({ id }) => id === tab)?.label}</h2>
      {tab === "roles" && onCreateEmployee && <button className="button button-dark" onClick={onCreateEmployee}>Create Employee</button>}
    </div>
    {tab === "locations" && <Locations {...props} editable={canEditLocations} />}
    {tab === "admin-users" && <AdminUsers {...props} showCreate={showCreateEmployee} setShowCreate={onToggleCreateEmployee} />}
    {tab === "roles" && <Roles {...props} role={role} />}
    {tab === "audit-logs" && <AuditLogs {...props} />}
    {tab === "settings" && <AdminSettings {...props} />}
  </section>;
}
