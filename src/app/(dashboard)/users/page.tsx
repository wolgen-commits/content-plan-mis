'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { formatDate } from '@/lib/utils';
import { User, UserRole } from '@/types';
import { toast } from 'sonner';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'content_planner', label: 'Content Planner' },
  { value: 'manager_marketing', label: 'Manager Marketing' },
  { value: 'designer', label: 'Designer' },
  { value: 'videographer', label: 'Videographer' },
];

export default function UsersPage() {
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'content_planner' as UserRole });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      const json = await res.json();
      return (json.data ?? []) as User[];
    },
    enabled: user?.role === 'admin',
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { toast.success('User berhasil dibuat'); queryClient.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<typeof form> & { id: string }) => {
      const { id, ...data } = payload;
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { toast.success('User berhasil diupdate'); queryClient.invalidateQueries({ queryKey: ['users'] }); setShowModal(false); setEditUser(null); resetForm(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('User dihapus'); queryClient.invalidateQueries({ queryKey: ['users'] }); setDeleteId(null); },
    onError: () => toast.error('Gagal menghapus user'),
  });

  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-400">Akses ditolak. Halaman ini hanya untuk admin.</p>
      </div>
    );
  }

  function resetForm() {
    setForm({ name: '', email: '', password: '', role: 'content_planner' });
  }

  function openCreate() {
    resetForm();
    setEditUser(null);
    setShowModal(true);
  }

  function openEdit(u: User) {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowModal(true);
  }

  function handleSubmit() {
    if (editUser) {
      updateMutation.mutate({ id: editUser.id, name: form.name, email: form.email, role: form.role, ...(form.password ? { password: form.password } : {}) });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-brand mb-1">Admin</p>
          <h1 className="text-[20px] font-bold text-gray-900">Manajemen User</h1>
        </div>
        <Button onClick={openCreate}>+ Tambah User</Button>
      </div>

      <div className="overflow-x-auto rounded-card border border-gray-200 bg-white">
        {isLoading ? (
          <div className="p-10 text-center text-[13px] text-gray-400">Memuat...</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-[10px] text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-500 border-b border-gray-200">Pengguna</th>
                <th className="px-4 py-[10px] text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-500 border-b border-gray-200">Role</th>
                <th className="px-4 py-[10px] text-left text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-500 border-b border-gray-200">Bergabung</th>
                <th className="px-4 py-[10px] text-right text-[11px] font-semibold uppercase tracking-[0.8px] text-gray-500 border-b border-gray-200">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors group">
                  <td className="px-5 py-[11px] text-gray-900 font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} avatarUrl={u.avatar_url} size="sm" />
                      <div>
                        <p className="font-medium text-gray-900">{u.name}</p>
                        <p className="text-[11px] text-gray-400 font-normal">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-[11px] text-gray-700">
                    <span className="inline-flex items-center gap-[5px] px-[10px] py-[2px] rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 capitalize">
                      {u.role.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-[11px] font-mono text-[12px] text-gray-500">{formatDate(u.created_at)}</td>
                  <td className="px-4 py-[11px]">
                    <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(u)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => setDeleteId(u.id)} disabled={u.id === user?.id}>
                        Hapus
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); setEditUser(null); resetForm(); }}
        title={editUser ? 'Edit User' : 'Tambah User Baru'}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowModal(false); setEditUser(null); resetForm(); }}>Batal</Button>
            <Button onClick={handleSubmit} loading={isPending}>{editUser ? 'Simpan Perubahan' : 'Buat User'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nama</label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nama lengkap" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
            <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@domain.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Password {editUser && <span className="text-gray-400 font-normal">(kosongkan jika tidak diubah)</span>}
            </label>
            <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <Select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
        title="Hapus User"
        description="Yakin ingin menghapus user ini? Aksi ini tidak bisa dibatalkan."
        confirmLabel="Hapus"
        danger
      />
    </div>
  );
}
