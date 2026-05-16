import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { createUser, deleteUser, fetchUsers, fetchUsersSummary, updateUser, updateUserStatus } from '../../../api/users.api.js';
import { getErrorMessage } from '../../../api/client.js';
import { AppHeader } from '../../../components/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../components/ui/ActionIcons.jsx';
import { cx, statusPill, ui } from '../../../styles/tailwindClasses.js';

const initialFilters = {
  search: '',
  status: '',
  role: '',
};

const initialUserForm = {
  fullName: '',
  email: '',
  password: '',
  role: 'student',
  status: 'inactive',
};

const usersPageUi = {
  accountHeader:
    'flex flex-wrap items-start justify-between gap-3 max-[640px]:grid max-[640px]:grid-cols-1',
  accountHeaderCopy: 'min-w-0',
  accountHeaderAction:
    'max-[640px]:w-full max-[640px]:min-h-11',
  filterActions:
    'items-end max-[520px]:items-stretch',
  statusActions:
    'flex flex-wrap items-center gap-2 max-[520px]:grid max-[520px]:w-full max-[520px]:grid-cols-1 max-[520px]:items-stretch',
  compactRowAction:
    'max-[520px]:min-h-10 max-[520px]:w-full',
  tableActions:
    'max-[520px]:grid max-[520px]:w-full max-[520px]:grid-cols-[minmax(0,1fr)_40px_40px] max-[520px]:items-center',
};

function EntityModal({ open, title, subtitle, children, onClose }) {
  if (!open) {
    return null;
  }

  return createPortal(
    <div className={ui.modalBackdrop} onClick={onClose}>
      <div className={ui.entityModal} onClick={(event) => event.stopPropagation()}>
        <div className={ui.entityModalTop}>
          <div>
            <h2 className={ui.entityModalTitle}>{title}</h2>
            {subtitle ? <p className={ui.entityModalText}>{subtitle}</p> : null}
          </div>
          <button type="button" className={ui.subtleIconButton} onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

function UserOverviewCards({ summary, activeQuickFilter, onQuickFilter }) {
  const cards = [
    { key: 'all', label: 'Total Users', value: summary.totalUsers, icon: '◎', tone: 'blue', badge: 'All users' },
    { key: 'active', label: 'Active Users', value: summary.activeUsers, icon: '●', tone: 'green', badge: 'Active' },
    { key: 'pending', label: 'Pending Approval', value: summary.pendingUsers, icon: '◔', tone: 'amber', badge: 'Pending' },
    { key: 'admins', label: 'Admins', value: summary.adminUsers, icon: '👤', tone: 'violet', badge: 'Admin role' },
    { key: 'students', label: 'Students', value: summary.studentUsers, icon: '🎓', tone: 'teal', badge: 'Student role' },
  ];

  return (
    <section className="grid gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {cards.map((card) => (
          <button className={cx(
              'grid min-h-[132px] gap-3 rounded-lg border bg-surface-1 p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-brand-primary/25 hover:shadow-md',
              activeQuickFilter === card.key ? 'border-brand-primary/50 ring-4 ring-brand-primary/10' : 'border-line-soft'
            )}
            key={card.key}
            type="button"
           
            onClick={() => onQuickFilter(card.key)}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="grid size-9 place-items-center rounded-md bg-brand-primary-light text-base text-brand-primary" aria-hidden="true">{card.icon}</span>
              <span className={ui.tablePill}>{card.badge}</span>
            </div>
            <strong className="text-3xl font-black text-ink-strong">{card.value}</strong>
            <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">{card.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending' },
          { key: 'active', label: 'Active' },
          { key: 'admins', label: 'Admins' },
          { key: 'students', label: 'Students' },
        ].map((chip) => (
          <button className={cx(
              'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-extrabold transition',
              activeQuickFilter === chip.key
                ? 'border-brand-primary bg-brand-primary-light text-brand-primary'
                : 'border-line-soft bg-surface-1 text-ink-soft hover:border-brand-primary/30 hover:text-brand-primary'
            )}
            key={chip.key}
            type="button"
           
            onClick={() => onQuickFilter(chip.key)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function UserStatsCard({ summary }) {
  return (
    <section className={cx(ui.panelCard, 'grid gap-4')}>
      <div>
        <div>
          <span className={ui.eyebrow}>User Overview</span>
          <h2 className={ui.panelTitle}>Total Users</h2>
        </div>
      </div>

      <div className="grid gap-1 rounded-lg border border-line-soft bg-surface-2 p-4">
        <strong className="text-4xl font-black text-ink-strong">{summary.totalUsers}</strong>
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">Total Users</span>
      </div>

      <div className="h-px bg-line-soft" />

      <div className="flex flex-wrap gap-2">
        <span className={statusPill('active')}>Active {summary.activeUsers}</span>
        <span className={statusPill('pending')}>Pending {summary.pendingUsers}</span>
      </div>

      <div className="h-px bg-line-soft" />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-2 p-3">
          <span className="grid size-9 place-items-center rounded-md bg-brand-primary-light text-brand-primary" aria-hidden="true">👤</span>
          <div>
            <strong className="block text-lg font-black text-ink-strong">{summary.adminUsers}</strong>
            <span className="text-xs font-bold text-ink-soft">Admins</span>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-2 p-3">
          <span className="grid size-9 place-items-center rounded-md bg-brand-primary-light text-brand-primary" aria-hidden="true">🎓</span>
          <div>
            <strong className="block text-lg font-black text-ink-strong">{summary.studentUsers}</strong>
            <span className="text-xs font-bold text-ink-soft">Students</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function UsersPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(initialFilters);
  const [users, setUsers] = useState([]);
  const [quickFilter, setQuickFilter] = useState('all');
  const [summary, setSummary] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    activeUsers: 0,
    adminUsers: 0,
    studentUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadUsers(initialFilters);
    loadSummary();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadUsers(filters);
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [filters]);

  async function loadUsers(nextFilters = filters) {
    setLoading(true);

    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const data = await fetchUsers(params);
      setUsers(data);
    } catch (loadError) {
      showToast(getErrorMessage(loadError, 'Unable to load users'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadSummary() {
    try {
      const data = await fetchUsersSummary();
      setSummary(data);
    } catch {
      // Summary is supportive, not critical.
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleQuickFilter(nextQuickFilter) {
    setQuickFilter(nextQuickFilter);

    if (nextQuickFilter === 'all') {
      setFilters((current) => ({ ...current, status: '', role: '' }));
      return;
    }

    if (nextQuickFilter === 'pending') {
      setFilters((current) => ({ ...current, status: 'inactive', role: '' }));
      return;
    }

    if (nextQuickFilter === 'active') {
      setFilters((current) => ({ ...current, status: 'active', role: '' }));
      return;
    }

    if (nextQuickFilter === 'admins') {
      setFilters((current) => ({ ...current, role: 'admin', status: '' }));
      return;
    }

    if (nextQuickFilter === 'students') {
      setFilters((current) => ({ ...current, role: 'student', status: '' }));
    }
  }

  function handleUserFormChange(event) {
    const { name, value } = event.target;
    setUserForm((current) => ({ ...current, [name]: value }));
  }

  async function handleFilterSubmit(event) {
    event.preventDefault();
    await loadUsers(filters);
  }

  async function handleReset() {
    setFilters(initialFilters);
    setQuickFilter('all');
    await loadUsers(initialFilters);
  }

  function showToast(text, type = 'success') {
    setToast({ text, type });
  }

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  function handleEditUser(user) {
    setEditingUserId(user.id);
    setUserForm({
      fullName: user.fullName,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
    });
    setModalOpen(true);
  }

  function handleOpenCreateUser() {
    setEditingUserId(null);
    setUserForm(initialUserForm);
    setModalOpen(true);
  }

  function handleCancelEdit() {
    setEditingUserId(null);
    setModalOpen(false);
    setUserForm(initialUserForm);
  }

  async function handleSaveUser(event) {
    event.preventDefault();

    try {
      if (editingUserId) {
        const updatedUser = await updateUser(editingUserId, {
          fullName: userForm.fullName,
          email: userForm.email,
          ...(userForm.password ? { password: userForm.password } : {}),
          role: userForm.role,
        });

        setUsers((current) =>
          current.map((user) => (user.id === editingUserId ? { ...user, ...updatedUser } : user))
        );
        showToast('User updated successfully.', 'success');
      } else {
        const createdUser = await createUser({
          fullName: userForm.fullName,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          status: userForm.status,
        });
        setUsers((current) => [createdUser, ...current]);
        showToast('New user created successfully.', 'success');
      }

      handleCancelEdit();
      await loadSummary();
    } catch (saveError) {
      showToast(getErrorMessage(saveError, 'Unable to save user'), 'error');
    }
  }

  async function handleDeleteUser(user) {
    if (!window.confirm(`Delete ${user.fullName}? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      showToast('User deleted successfully.', 'success');
      if (editingUserId === user.id) {
        handleCancelEdit();
      }
      await loadSummary();
    } catch (deleteError) {
      showToast(getErrorMessage(deleteError, 'Unable to delete user'), 'error');
    }
  }

  async function handleStatusChange(user, status) {
    try {
      await updateUserStatus(user.id, status);
      setUsers((current) =>
        current.map((item) => (item.id === user.id ? { ...item, status } : item))
      );
      showToast(status === 'active' ? 'User approved successfully.' : 'User moved to inactive.', 'success');
      await loadSummary();
    } catch (updateError) {
      showToast(getErrorMessage(updateError, 'Unable to update user status'), 'error');
    }
  }

  const isEditing = Boolean(editingUserId);

  return (
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
        <AppHeader
          title="Users"
          subtitle="Manage student approvals, roles, and access."
        />

        {toast && createPortal(
          <div className={ui.toastContainer} role="status" aria-live="polite">
            <div className={cx(ui.toast, toast.type === 'success' ? ui.toastSuccess : ui.toastError)}>
              <span className={ui.toastIcon} aria-hidden="true">
                {toast.type === 'success' ? '✓' : '⚠'}
              </span>
              <span>{toast.text}</span>
            </div>
          </div>,
          document.body
        )}

        <UserOverviewCards summary={summary} activeQuickFilter={quickFilter} onQuickFilter={handleQuickFilter} />

        <section className={ui.panelCard}>
          <form className="grid gap-4 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]" onSubmit={handleFilterSubmit}>
            <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Search
              <input className="min-h-control rounded-md border border-line-medium bg-input-bg px-3 text-sm font-semibold normal-case tracking-normal text-ink-strong outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20"
               
                name="search"
                value={filters.search}
                onChange={handleChange}
                placeholder="Search by name or email"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Status
              <select className="min-h-control rounded-md border border-line-medium bg-input-bg px-3 text-sm font-semibold normal-case tracking-normal text-ink-strong outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20" name="status" value={filters.status} onChange={handleChange}>
                <option value="">All</option>
                <option value="inactive">Pending approval</option>
                <option value="active">Active</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Role
              <select className="min-h-control rounded-md border border-line-medium bg-input-bg px-3 text-sm font-semibold normal-case tracking-normal text-ink-strong outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20" name="role" value={filters.role} onChange={handleChange}>
                <option value="">All</option>
                <option value="admin">Admin</option>
                <option value="student">Student</option>
              </select>
            </label>

            <div className={cx(ui.buttonRow, usersPageUi.filterActions)}>
              <button type="submit" className={ui.secondaryAction}>Refresh</button>
              <button type="button" className={ui.secondaryAction} onClick={handleReset}>Reset</button>
            </div>
          </form>
        </section>

        <section className={ui.panelCard}>
          <div className={usersPageUi.accountHeader}>
            <div className={usersPageUi.accountHeaderCopy}>
              <h2 className={ui.panelTitle}>User accounts</h2>
              <p className={ui.panelText}>Create student and admin accounts, or update existing user details.</p>
            </div>
            <button type="button" className={cx(ui.secondaryAction, usersPageUi.accountHeaderAction)} onClick={handleOpenCreateUser}>
              Create new user
            </button>
          </div>
        </section>

        <EntityModal
          open={modalOpen}
          title={isEditing ? 'Edit user' : 'Create new user'}
          subtitle="Create student and admin accounts, or update existing user details."
          onClose={handleCancelEdit}
        >
          <form className={cx(ui.formGrid, ui.modalForm)} onSubmit={handleSaveUser}>
            <label className={ui.formLabel}>
              Full name
              <input className={ui.input}
                name="fullName"
                value={userForm.fullName}
                onChange={handleUserFormChange}
                required
                placeholder="Jane Doe"
              />
            </label>

            <label className={ui.formLabel}>
              Email address
              <input className={ui.input}
                type="email"
                name="email"
                value={userForm.email}
                onChange={handleUserFormChange}
                required
                placeholder="jane@example.com"
              />
            </label>

            {!isEditing ? (
              <label className={ui.formLabel}>
                Password
                <input className={ui.input}
                  type="password"
                  name="password"
                  value={userForm.password}
                  onChange={handleUserFormChange}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                />
              </label>
            ) : null}

            {isEditing ? (
              <label className={ui.formLabel}>
                New password
                <input className={ui.input}
                  type="password"
                  name="password"
                  value={userForm.password}
                  onChange={handleUserFormChange}
                  minLength={6}
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current"
                />
              </label>
            ) : null}

            <label className={ui.formLabel}>
              Role
              <select className={ui.input} name="role" value={userForm.role} onChange={handleUserFormChange}>
                <option value="student">Student</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            {!isEditing ? (
              <label className={ui.formLabel}>
                Status
                <select className={ui.input} name="status" value={userForm.status} onChange={handleUserFormChange}>
                  <option value="inactive">Pending approval</option>
                  <option value="active">Active</option>
                </select>
              </label>
            ) : null}

            <div className={cx(ui.buttonRow, ui.formActions)}>
              <button className={ui.primaryAction} type="submit">{isEditing ? 'Save changes' : 'Create user'}</button>
              <button type="button" className={ui.secondaryAction} onClick={handleCancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        </EntityModal>

        <section className={ui.panelCard}>
          <div className={ui.tableShell}>
            <table className={ui.modernTable}>
              <thead>
                <tr>
                  <th className={ui.tableHeadCell}>Name</th>
                  <th className={ui.tableHeadCell}>Email</th>
                  <th className={ui.tableHeadCell}>Role</th>
                  <th className={ui.tableHeadCell}>Status</th>
                  <th className={ui.tableHeadCell}>Created</th>
                  <th className={ui.tableHeadCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className={ui.tableEmpty}>Loading users...</td>
                  </tr>
                ) : null}
                {!loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={ui.tableEmpty}>No users found.</td>
                  </tr>
                ) : null}
                {!loading && users.map((user) => (
                  <tr key={user.id}>
                    <td className={ui.tableCell}><strong>{user.fullName}</strong></td>
                    <td className={ui.tableCell}>{user.email}</td>
                    <td className={ui.tableCell}><span className={ui.tablePill}>{user.role}</span></td>
                    <td className={ui.tableCell}>
                      <div className={usersPageUi.statusActions}>
                        <span className={statusPill(user.status)}>
                          {user.status === 'inactive' ? 'Pending approval' : 'Active'}
                        </span>
                        {user.status !== 'active' ? (
                          <button className={cx('inline-flex min-h-8 items-center justify-center rounded-md border border-brand-success/25 bg-[var(--color-success-light)] px-3 text-xs font-extrabold text-brand-success transition hover:-translate-y-0.5', usersPageUi.compactRowAction)}
                            type="button"
                           
                            aria-label={`Approve ${user.fullName}`}
                            onClick={() => handleStatusChange(user, 'active')}
                          >
                            Approve
                          </button>
                        ) : null}
                        {user.role !== 'admin' && user.status === 'active' ? (
                          <button className={cx('inline-flex min-h-8 items-center justify-center rounded-md border border-brand-error/20 bg-brand-error/10 px-3 text-xs font-extrabold text-brand-error transition hover:-translate-y-0.5', usersPageUi.compactRowAction)}
                            type="button"
                           
                            aria-label={`Inactivate ${user.fullName}`}
                            onClick={() => handleStatusChange(user, 'inactive')}
                          >
                            Disable
                          </button>
                        ) : null}
                        {user.status !== 'active' && user.role !== 'admin' ? (
                          <button className={cx('inline-flex min-h-8 items-center justify-center rounded-md border border-brand-error/20 bg-brand-error/10 px-3 text-xs font-extrabold text-brand-error transition hover:-translate-y-0.5', usersPageUi.compactRowAction)}
                            type="button"
                           
                            aria-label={`Reject ${user.fullName}`}
                            onClick={() => handleStatusChange(user, 'inactive')}
                          >
                            Reject
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className={ui.tableCell}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}</td>
                    <td className={ui.tableCell}>
                      <div className={cx(ui.iconRow, usersPageUi.tableActions)}>
                        {user.role === 'student' ? (
                          <button className={cx(ui.secondaryAction, usersPageUi.compactRowAction)}
                            type="button"
                            onClick={() => navigate(`/users/${user.id}`)}
                          >
                            View
                          </button>
                        ) : null}
                        <button className={ui.iconButton}
                          type="button"
                         
                          aria-label={`Edit ${user.fullName}`}
                          title="Edit user"
                          onClick={() => handleEditUser(user)}
                        >
                          <EditActionIcon />
                        </button>
                        <button className={ui.dangerIconButton}
                          type="button"
                         
                          aria-label={`Delete ${user.fullName}`}
                          title="Delete user"
                          onClick={() => handleDeleteUser(user)}
                        >
                          <DeleteActionIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </section>
      </main>
  );
}
