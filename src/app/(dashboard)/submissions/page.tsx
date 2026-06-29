'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';

/* ── Types ── */
interface StorageItem {
  name: string;
  isFolder: boolean;
  size: number | null;
  mimetype: string | null;
  updatedAt: string | null;
  path: string;
  publicUrl: string | null;
}

/* ── Helpers ── */
function fmtSize(bytes: number | null) {
  if (bytes === null) return '';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getExtension(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isRawPath(path: string) {
  return path.includes('/RAW/') || path.endsWith('/RAW');
}

function isFinalPath(path: string) {
  return path.includes('/Final/') || path.endsWith('/Final');
}

/* ── Icons ── */
function FolderIcon({ color = '#BB2649', size = 40 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
        fill={color + '22'} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function FileIcon({ ext, size = 40 }: { ext: string; size?: number }) {
  const VIDEO_EXTS  = ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'];
  const IMAGE_EXTS  = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'psd', 'ai'];
  const DOC_EXTS    = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

  let color = '#6B7280';
  let path  = <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>;
  let label = ext.toUpperCase();
  let labelColor = color;

  if (VIDEO_EXTS.includes(ext)) {
    color = '#EF4444'; labelColor = color;
    path = <><rect x="2" y="4" width="20" height="16" rx="2" fill="#FEE2E2"/><path d="M10 9l5 3-5 3V9z" fill="#EF4444"/></>;
    label = 'VIDEO';
  } else if (IMAGE_EXTS.includes(ext)) {
    color = '#8B5CF6'; labelColor = color;
    path = <><rect x="2" y="2" width="20" height="20" rx="2" fill="#EDE9FE"/><circle cx="8.5" cy="8.5" r="1.5" fill="#8B5CF6"/><polyline points="21 15 16 10 5 21" stroke="#8B5CF6" strokeWidth="1.5"/></>;
    label = 'IMG';
  } else if (DOC_EXTS.includes(ext)) {
    color = '#3B82F6'; labelColor = color;
    path = <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#DBEAFE"/><polyline points="14 2 14 8 20 8" stroke="#3B82F6" strokeWidth="1.5"/></>;
    label = ext.toUpperCase();
  }

  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'psd', 'ai'].includes(ext)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke={color}>
        {path}
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" stroke={color}>
      {path}
      <polyline points="14 2 14 8 20 8" stroke={color}/>
      <text x="12" y="18" textAnchor="middle" fontSize="4.5" fill={labelColor} fontWeight="700" fontFamily="sans-serif" stroke="none">
        {label.slice(0, 4)}
      </text>
    </svg>
  );
}

/* ── Status badge for RAW / Final folders ── */
function FolderBadge({ name }: { name: string }) {
  if (name === 'RAW')   return <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">RAW</span>;
  if (name === 'Final') return <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">FINAL</span>;
  return null;
}

/* ── Root folders for sidebar tree (only video & design) ── */
const ROOT_FOLDERS = [
  { key: 'video',  label: 'Video',  color: '#EF4444' },
  { key: 'design', label: 'Design', color: '#8B5CF6' },
];

/* ── Breadcrumb ── */
function Breadcrumb({ path, onNavigate }: { path: string; onNavigate: (p: string) => void }) {
  const parts = path ? path.split('/') : [];
  return (
    <nav className="flex items-center gap-1 text-[12px]">
      <button onClick={() => onNavigate('')}
        className={`flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${!path ? 'text-gray-800 font-semibold bg-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        Submissions
      </button>
      {parts.map((part, i) => {
        const partPath = parts.slice(0, i + 1).join('/');
        const isLast   = i === parts.length - 1;
        return (
          <div key={partPath} className="flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
            <button onClick={() => !isLast && onNavigate(partPath)}
              className={`px-2 py-1 rounded-md transition-colors ${isLast ? 'text-gray-800 font-semibold bg-gray-100' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'} flex items-center gap-1`}>
              {part}
              <FolderBadge name={part} />
            </button>
          </div>
        );
      })}
    </nav>
  );
}

/* ── Grid Item ── */
function GridItem({ item, onOpen }: { item: StorageItem; onOpen: (item: StorageItem) => void }) {
  const ext      = item.isFolder ? '' : getExtension(item.name);
  const isStatus = item.name === 'RAW' || item.name === 'Final';
  const folderColor = item.name === 'video' ? '#EF4444' : item.name === 'design' ? '#8B5CF6'
    : item.name === 'Final' ? '#10B981' : item.name === 'RAW' ? '#F59E0B' : '#BB2649';

  return (
    <div
      onDoubleClick={() => onOpen(item)}
      onClick={() => item.isFolder && onOpen(item)}
      className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all cursor-pointer select-none ${item.isFolder ? '' : 'cursor-default'}`}
    >
      {item.isFolder
        ? <FolderIcon color={folderColor} size={48} />
        : <FileIcon ext={ext} size={48} />
      }
      <div className="text-center min-w-0 w-full">
        <p className="text-[11px] font-medium text-gray-700 truncate leading-tight flex items-center justify-center gap-1">
          {item.name}
          {isStatus && <FolderBadge name={item.name} />}
        </p>
        {!item.isFolder && item.size !== null && (
          <p className="text-[10px] text-gray-400 mt-0.5">{fmtSize(item.size)}</p>
        )}
      </div>
      {/* Hover overlay actions for files */}
      {!item.isFolder && item.publicUrl && (
        <a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-6 h-6 bg-white border border-gray-200 rounded-md flex items-center justify-center shadow-sm hover:bg-brand hover:border-brand hover:text-white text-gray-500 transition-all"
          title="Download">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </a>
      )}
    </div>
  );
}

/* ── List Row ── */
function ListRow({ item, onOpen }: { item: StorageItem; onOpen: (item: StorageItem) => void }) {
  const ext = item.isFolder ? '' : getExtension(item.name);
  const folderColor = item.name === 'video' ? '#EF4444' : item.name === 'design' ? '#8B5CF6'
    : item.name === 'Final' ? '#10B981' : item.name === 'RAW' ? '#F59E0B' : '#BB2649';

  return (
    <tr
      onDoubleClick={() => onOpen(item)}
      onClick={() => item.isFolder && onOpen(item)}
      className={`group border-b border-gray-50 last:border-0 hover:bg-blue-50/40 transition-colors ${item.isFolder ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <td className="px-4 py-2.5 flex items-center gap-3 min-w-0">
        <span className="flex-shrink-0">
          {item.isFolder
            ? <FolderIcon color={folderColor} size={22} />
            : <FileIcon ext={ext} size={22} />
          }
        </span>
        <span className="text-[12px] font-medium text-gray-800 truncate flex items-center gap-1">
          {item.name}
          {(item.name === 'RAW' || item.name === 'Final') && <FolderBadge name={item.name} />}
          {/* file path status */}
          {!item.isFolder && isRawPath(item.path) && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">RAW</span>
          )}
          {!item.isFolder && isFinalPath(item.path) && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">FINAL</span>
          )}
        </span>
      </td>
      <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap">
        {item.isFolder ? 'Folder' : (item.mimetype?.split('/')[1]?.toUpperCase() ?? ext.toUpperCase())}
      </td>
      <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap">
        {item.isFolder ? '—' : fmtSize(item.size)}
      </td>
      <td className="px-4 py-2.5 text-[11px] text-gray-400 whitespace-nowrap">
        {fmtDate(item.updatedAt)}
      </td>
      <td className="px-4 py-2.5 text-right">
        {!item.isFolder && item.publicUrl && (
          <a href={item.publicUrl} download={item.name} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 px-2.5 py-1 rounded-btn text-[10px] font-semibold bg-gray-100 hover:bg-brand hover:text-white text-gray-600 transition-all">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download
          </a>
        )}
      </td>
    </tr>
  );
}

/* ── Main Page ── */
export default function SubmissionsPage() {
  const user = useAuthStore(s => s.user);
  const [currentPath, setCurrentPath] = useState('');
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid');
  const [sidebarFolder, setSidebarFolder] = useState<string | null>(null);

  const navigate = useCallback((path: string) => {
    setCurrentPath(path);
    const root = path.split('/')[0];
    if (root === 'video' || root === 'design') setSidebarFolder(root);
    else setSidebarFolder(null);
  }, []);

  const { data: items = [], isLoading } = useQuery<StorageItem[]>({
    queryKey: ['storage-browse', currentPath],
    queryFn: async () => {
      const res = await fetch(`/api/storage/browse?path=${encodeURIComponent(currentPath)}`);
      const json = await res.json();
      return json.data ?? [];
    },
  });

  // For sidebar: list year-month folders inside the selected root
  const { data: sidebarItems = [] } = useQuery<StorageItem[]>({
    queryKey: ['storage-browse', sidebarFolder],
    queryFn: async () => {
      const res = await fetch(`/api/storage/browse?path=${encodeURIComponent(sidebarFolder!)}`);
      const json = await res.json();
      return (json.data ?? []).filter((i: StorageItem) => i.isFolder);
    },
    enabled: !!sidebarFolder,
  });

  function handleOpen(item: StorageItem) {
    if (item.isFolder) navigate(item.path);
  }

  const rootDepth = currentPath ? currentPath.split('/').length : 0;
  const emptyMessage = currentPath ? 'Folder ini kosong.' : 'Belum ada file yang disubmit.';

  return (
    <div className="flex h-full min-h-screen" style={{ background: '#F8F8FA' }}>

      {/* ── Left Sidebar (folder tree) ── */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col py-3">
        <p className="px-4 text-[10px] font-bold uppercase tracking-[0.8px] text-gray-400 mb-2">Storage</p>

        {ROOT_FOLDERS.map(rf => {
          const isActive = currentPath.startsWith(rf.key);
          return (
            <div key={rf.key}>
              <button onClick={() => navigate(rf.key)}
                className={`w-full flex items-center gap-2.5 px-4 py-2 text-[12px] font-medium transition-colors ${isActive ? 'bg-brand/10 text-brand' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}`}>
                <FolderIcon color={rf.color} size={18} />
                {rf.label}
              </button>

              {/* Expand year-month sub-folders */}
              {isActive && sidebarFolder === rf.key && sidebarItems.map(ym => {
                const ymActive = currentPath.startsWith(ym.path);
                return (
                  <button key={ym.path} onClick={() => navigate(ym.path)}
                    className={`w-full flex items-center gap-2.5 pl-9 pr-4 py-1.5 text-[11px] transition-colors ${ymActive ? 'text-brand font-semibold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    {ym.name}
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
          <Breadcrumb path={currentPath} onNavigate={navigate} />

          <div className="flex items-center gap-3">
            {/* Item count */}
            {items.length > 0 && (
              <span className="text-[11px] text-gray-400">
                {items.filter(i => i.isFolder).length} folder, {items.filter(i => !i.isFolder).length} file
              </span>
            )}
            {/* View toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1.5 transition-colors ${viewMode === 'grid' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-50'}`}
                title="Grid view">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              </button>
              <button onClick={() => setViewMode('list')}
                className={`px-2.5 py-1.5 transition-colors border-l border-gray-200 ${viewMode === 'list' ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-50'}`}
                title="List view">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Root: show big folder cards for video & design */}
        {!currentPath && (
          <div className="p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.8px] text-gray-400 mb-4">Semua Folder</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {ROOT_FOLDERS.map(rf => (
                <div key={rf.key} onClick={() => navigate(rf.key)}
                  className="flex flex-col items-center gap-2.5 p-5 rounded-xl border border-gray-200 bg-white hover:border-brand/30 hover:shadow-md cursor-pointer transition-all group">
                  <FolderIcon color={rf.color} size={52} />
                  <p className="text-[12px] font-semibold text-gray-700 group-hover:text-brand transition-colors">{rf.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Browse content */}
        {currentPath && (
          <div className="flex-1 p-5">
            {isLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="flex items-center gap-2 text-[13px] text-gray-400">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Memuat...
                </div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <p className="text-[13px] text-gray-400">{emptyMessage}</p>
              </div>
            ) : viewMode === 'grid' ? (
              /* ── Grid View ── */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1">
                {items.map(item => (
                  <GridItem key={item.path} item={item} onOpen={handleOpen} />
                ))}
              </div>
            ) : (
              /* ── List View ── */
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-gray-400">Nama</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-gray-400">Tipe</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-gray-400">Ukuran</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-gray-400">Dimodifikasi</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <ListRow key={item.path} item={item} onOpen={handleOpen} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
