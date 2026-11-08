import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { createUser, deleteUser, fetchUsers, fetchUsersSummary, updateUser, updateUserStatus } from '../../../../shared/api/users.api.js';
import { getErrorMessage } from '../../../../shared/api/client.js';
import { AppHeader } from '../../../../shared/layout/AppHeader.jsx';
import { DeleteActionIcon, EditActionIcon } from '../../../../shared/ui/ActionIcons.jsx';
import { FeedbackNotice } from '../../../../shared/ui/FeedbackNotice.jsx';
import { PasswordField } from '../../../../shared/ui/PasswordField.jsx';
import { cx, statusPill, ui } from '../../../../shared/styles/tailwindClasses.js';
import { getAdminUserIdentifier, getAdminUserSecondaryIdentifier } from '../../../../shared/utils/userIdentity.js';

const initialFilters = {
  search: '',
  status: '',
  role: '',
};

function getFilterKey(filters) {
  return JSON.stringify(filters);
}

const initialUserForm = {
  fullName: '',
  email: '',
  password: '',
  role: 'student',
  status: 'inactive',
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
    { key: 'all', label: 'Total users', value: summary.totalUsers },
    { key: 'active', label: 'Active', value: summary.activeUsers },
    { key: 'pending', label: 'Pending approval', value: summary.pendingUsers },
    { key: 'admins', label: 'Admins', value: summary.adminUsers },
    { key: 'students', label: 'Students', value: summary.studentUsers },
  ];

  // The tiles ARE the quick filters — one control, not tiles plus a duplicate row of chips.
  return (
    <section className="grid grid-cols-5 gap-3 max-[1000px]:grid-cols-3 max-[640px]:grid-cols-2" aria-label="Filter users">
      {cards.map((card) => (
        <button
          key={card.key}
          type="button"
          aria-pressed={activeQuickFilter === card.key}
          onClick={() => onQuickFilter(card.key)}
          className={cx(
            'grid gap-0.5 rounded-xl border !bg-surface-1 px-4 py-3 text-left shadow-none transition hover:border-brand-primary/30',
            activeQuickFilter === card.key ? 'border-brand-primary/60 ring-2 ring-brand-primary/15' : 'border-line-soft',
          )}
        >
          <strong className="text-[24px] font-black leading-none text-ink-strong">{card.value}</strong>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-ink-soft">{card.label}</span>
        </button>
      ))}
    </section>
  );
}

const PAGE_SIZE = 20;

export function UsersPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(initialFilters);
  const lastLoadedFilterKeyRef = useRef(getFilterKey(initialFilters));
  const usersRequestIdRef = useRef(0);
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
  const [page, setPage] = useState(1);

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
  }, []);

  const loadUsers = useCallback(async (nextFilters = initialFilters) => {
    lastLoadedFilterKeyRef.current = getFilterKey(nextFilters);
    const requestId = usersRequestIdRef.current + 1;
    usersRequestIdRef.current = requestId;
    setLoading(true);

    try {
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value));
      const data = await fetchUsers(params);
      if (usersRequestIdRef.current === requestId) {
        setUsers(data);
      }
    } catch (loadError) {
      if (usersRequestIdRef.current === requestId) {
        showToast(getErrorMessage(loadError, 'Unable to load users'), 'error');
      }
    } finally {
      if (usersRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [showToast]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await fetchUsersSummary();
      setSummary(data);
    } catch {
      // Summary is supportive, not critical.
    }
  }, []);

  useEffect(() => {
    loadUsers(initialFilters);
    loadSummary();
  }, [loadSummary, loadUsers]);

  useEffect(() => {
    const filterKey = getFilterKey(filters);
    if (filterKey === lastLoadedFilterKeyRef.current) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      loadUsers(filters);
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [filters, loadUsers]);

  function handleChange(event) {
    const { name, value } = event.target;
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  }

  function handleQuickFilter(nextQuickFilter) {
    setPage(1);
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
    if (!window.confirm(`Delete ${getAdminUserIdentifier(user)}? This cannot be undone.`)) {
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
  const pageCount = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageUsers = users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
      <main className={ui.screenShell}>
        <section className={ui.managementLayout}>
        <AppHeader
          title="Users"
          subtitle="Access Control"
        />

        {toast && createPortal(
          <div className={ui.toastContainer} role="status" aria-live="polite">
            <FeedbackNotice
              tone={toast.type === 'success' ? 'success' : 'error'}
              variant="toast"
              onDismiss={() => setToast(null)}
              resetKey={toast.text}
            >
              {toast.text}
            </FeedbackNotice>
          </div>,
          document.body
        )}

        <UserOverviewCards summary={summary} activeQuickFilter={quickFilter} onQuickFilter={handleQuickFilter} />

        <section className={cx(ui.panelCard, '!p-4')}>
          <form
            className="grid grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_minmax(140px,1fr)_auto_auto] items-end gap-3 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1"
            onSubmit={handleFilterSubmit}
          >
            <label className="grid min-w-0 gap-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Search
              <input className={ui.input} name="search" value={filters.search} onChange={handleChange} placeholder="Search by email address" />
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Status
              <select className={ui.input} name="status" value={filters.status} onChange={handleChange}>
                <option value="">All</option>
                <option value="inactive">Pending approval</option>
                <option value="active">Active</option>
              </select>
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-extrabold uppercase tracking-[0.06em] text-ink-muted">
              Role
              <select className={ui.input} name="role" value={filters.role} onChange={handleChange}>
                <option value="">All</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
                <option value="student">Student</option>
              </select>
            </label>

            <button type="button" className={cx(ui.secondaryAction, '!min-h-10 whitespace-nowrap !px-4')} onClick={handleReset}>Reset</button>
            <button type="button" className={cx(ui.primaryAction, '!min-h-10 whitespace-nowrap !px-4 max-[1000px]:col-span-2 max-[560px]:col-span-1')} onClick={handleOpenCreateUser}>
              + Create user
            </button>
          </form>
        </section>

        <EntityModal
          open={modalOpen}
          title={isEditing ? 'Edit user' : 'Create new user'}
          subtitle="User Accounts"
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
              <PasswordField
                label="Password"
                name="password"
                value={userForm.password}
                onChange={handleUserFormChange}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
            ) : null}

            {isEditing ? (
              <PasswordField
                label="New password"
                name="password"
                value={userForm.password}
                onChange={handleUserFormChange}
                minLength={6}
                autoComplete="new-password"
                placeholder="Leave blank to keep current"
              />
            ) : null}

            <label className={ui.formLabel}>
              Role
              <select className={ui.input} name="role" value={userForm.role} onChange={handleUserFormChange}>
                <option value="student">Student</option>
                <option value="staff">Staff (custom access)</option>
                <option value="admin">Admin (full access)</option>
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

        <section className={cx(ui.panelCard, 'grid gap-3 !p-4')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-black text-ink-strong">
              User accounts <span className="ml-1 font-bold text-ink-soft">· {users.length}</span>
            </h2>
            {users.length > PAGE_SIZE ? (
              <span className="text-[12.5px] font-bold text-ink-soft">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, users.length)} of {users.length}
              </span>
            ) : null}
          </div>

          <div className={ui.tableShell}>
            <table className={ui.modernTable} style={{ width: '100%', minWidth: 760 }}>
              <thead>
                <tr>
                  <th className={ui.tableHeadCell}>User</th>
                  <th className={ui.tableHeadCell}>Role</th>
                  <th className={ui.tableHeadCell}>Status</th>
                  <th className={ui.tableHeadCell}>Created</th>
                  <th className={cx(ui.tableHeadCell, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className={ui.tableEmpty}>Loading users...</td>
                  </tr>
                ) : null}
                {!loading && users.length === 0 ? (
                  <tr>
                    <td colSpan="5" className={ui.tableEmpty}>No users found.</td>
                  </tr>
                ) : null}
                {!loading && pageUsers.map((user) => {
                  const userIdentifier = getAdminUserIdentifier(user);
                  const userSecondaryIdentifier = getAdminUserSecondaryIdentifier(user);
                  const pending = user.status !== 'active';
                  const smallButton = 'inline-flex min-h-8 items-center justify-center whitespace-nowrap rounded-md border px-3 text-xs font-extrabold transition';

                  return (
                    <tr key={user.id} className="transition hover:bg-surface-2/50 [&>td]:!py-2.5">
                      <td className={cx(ui.tableCell, 'min-w-[220px]')}>
                        <strong className="block truncate text-[13.5px] text-ink-strong">{userIdentifier}</strong>
                        {userSecondaryIdentifier ? <div className={cx(ui.tableSubtext, 'truncate')}>{userSecondaryIdentifier}</div> : null}
                      </td>
                      <td className={cx(ui.tableCell, 'whitespace-nowrap')}><span className={ui.tablePill}>{user.role}</span></td>
                      <td className={cx(ui.tableCell, 'whitespace-nowrap')}>
                        <span className={statusPill(user.status)}>{pending ? 'Pending' : 'Active'}</span>
                      </td>
                      <td className={cx(ui.tableCell, 'whitespace-nowrap text-ink-soft')}>
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                      </td>
                      <td className={cx(ui.tableCell, 'whitespace-nowrap')}>
                        <div className="flex items-center justify-end gap-2">
                          {pending ? (
                            <button
                              className={cx(smallButton, 'border-brand-success/25 bg-[var(--color-success-light)] text-brand-success')}
                              type="button"
                              aria-label={`Approve ${userIdentifier}`}
                              onClick={() => handleStatusChange(user, 'active')}
                            >
                              Approve
                            </button>
                          ) : null}
                          {user.role !== 'admin' ? (
                            <button
                              className={cx(smallButton, 'border-brand-error/20 bg-brand-error/10 text-brand-error')}
                              type="button"
                              aria-label={`${pending ? 'Reject' : 'Disable'} ${userIdentifier}`}
                              onClick={() => handleStatusChange(user, 'inactive')}
                            >
                              {pending ? 'Reject' : 'Disable'}
                            </button>
                          ) : null}
                          {user.role === 'student' ? (
                            <button className={cx(ui.secondaryAction, '!min-h-8 !px-3 text-xs')} type="button" onClick={() => navigate(`/users/${user.id}`)}>
                              View
                            </button>
                          ) : null}
                          <button className={cx(ui.iconButton, '!size-8 !min-h-0 !min-w-0')}
                            type="button"
                            aria-label={`Edit ${userIdentifier}`}
                            title="Edit user"
                            onClick={() => handleEditUser(user)}
                          >
                            <EditActionIcon />
                          </button>
                          <button className={cx(ui.dangerIconButton, '!size-8 !min-h-0 !min-w-0')}
                            type="button"
                            aria-label={`Delete ${userIdentifier}`}
                            title="Delete user"
                            onClick={() => handleDeleteUser(user)}
                          >
                            <DeleteActionIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pageCount > 1 ? (
            <div className="flex items-center justify-between gap-2">
              <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>← Previous</button>
              <span className="text-[12.5px] font-bold text-ink-soft">Page {currentPage} of {pageCount}</span>
              <button type="button" className={cx(ui.secondaryAction, '!min-h-9 !px-3')} disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next →</button>
            </div>
          ) : null}
        </section>
        </section>
      </main>
  );
}
