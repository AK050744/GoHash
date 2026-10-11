import { useState, useEffect, useCallback, useMemo } from 'react'
import { ethers } from 'ethers'
import {
  Users,
  Shield,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Copy,
  Check,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import { useWallet } from '../../context/WalletContext'
import { api, ApiError } from '../../lib/api'
import type {
  AdminUser,
  AdminUsersResponse,
  AdminNotary,
  AdminNotariesResponse,
  BlockchainContractResponse,
} from '../../types'

type OnChainActionType = 'authorize' | 'revoke'

type OnChainState =
  | 'idle'
  | 'awaiting-wallet'
  | 'pending'
  | 'confirmed'
  | 'failed'
  | 'rejected-by-user'

export default function AdminNotariesPage() {
  const { user: currentAdmin } = useAuth()
  const {
    address: connectedWallet,
    isCorrectNetwork,
    connect,
    switchNetwork,
    getSigner,
  } = useWallet()

  // Data state
  const [users, setUsers] = useState<AdminUser[]>([])
  const [notariesMap, setNotariesMap] = useState<Map<string, AdminNotary>>(new Map())
  const [chainAvailable, setChainAvailable] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')

  // Role change modal state
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null)
  const [selectedNewRole, setSelectedNewRole] = useState<'USER' | 'NOTARY'>('NOTARY')
  const [updatingRole, setUpdatingRole] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  // Status toggle modal state
  const [statusModalUser, setStatusModalUser] = useState<AdminUser | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  // On-chain authorize/revoke state machine
  const [onChainTarget, setOnChainTarget] = useState<{
    user: AdminUser
    action: OnChainActionType
  } | null>(null)
  const [onChainState, setOnChainState] = useState<OnChainState>('idle')
  const [onChainTxHash, setOnChainTxHash] = useState<string | null>(null)
  const [onChainError, setOnChainError] = useState<string | null>(null)

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Fetch users & notaries with live authorization
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, notariesRes] = await Promise.all([
        api.get<AdminUsersResponse>('/admin/users?limit=100'),
        api.get<AdminNotariesResponse>('/admin/notaries'),
      ])

      setUsers(usersRes.users || [])
      setChainAvailable(notariesRes.chainAvailable)

      const nMap = new Map<string, AdminNotary>()
      for (const n of notariesRes.notaries || []) {
        nMap.set(n.id, n)
      }
      setNotariesMap(nMap)
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || 'Failed to load user and notary data.')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('An unexpected error occurred while loading data.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = u.name.toLowerCase().includes(q)
        const matchesEmail = u.email.toLowerCase().includes(q)
        const matchesWallet = u.walletAddress?.toLowerCase().includes(q)
        if (!matchesName && !matchesEmail && !matchesWallet) return false
      }
      return true
    })
  }, [users, roleFilter, searchQuery])

  // Short address formatting
  const formatShortAddress = (addr: string | null) => {
    if (!addr) return '—'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // --- Handlers: Off-chain Role Change ----------------------------------------
  const handleOpenRoleModal = (u: AdminUser) => {
    setRoleModalUser(u)
    setSelectedNewRole(u.role === 'NOTARY' ? 'USER' : 'NOTARY')
    setRoleError(null)
  }

  const handleConfirmRoleChange = async () => {
    if (!roleModalUser) return
    setUpdatingRole(true)
    setRoleError(null)

    try {
      await api.patch<{ success: boolean; user: AdminUser }>(
        `/admin/users/${roleModalUser.id}/role`,
        { role: selectedNewRole }
      )
      setRoleModalUser(null)
      await fetchData()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'CANNOT_MODIFY_SELF') {
          setRoleError('You cannot change your own administrator role.')
        } else {
          setRoleError(err.message || 'Failed to change user role.')
        }
      } else if (err instanceof Error) {
        setRoleError(err.message)
      } else {
        setRoleError('Failed to change user role.')
      }
    } finally {
      setUpdatingRole(false)
    }
  }

  // --- Handlers: Off-chain Account Status (Enable/Disable) ---------------------
  const handleOpenStatusModal = (u: AdminUser) => {
    setStatusModalUser(u)
    setStatusError(null)
  }

  const handleConfirmStatusToggle = async () => {
    if (!statusModalUser) return
    setUpdatingStatus(true)
    setStatusError(null)

    try {
      await api.patch<{ success: boolean; user: AdminUser }>(
        `/admin/users/${statusModalUser.id}/status`,
        { isActive: !statusModalUser.isActive }
      )
      setStatusModalUser(null)
      await fetchData()
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'CANNOT_MODIFY_SELF') {
          setStatusError('You cannot disable your own administrator account.')
        } else {
          setStatusError(err.message || 'Failed to update account status.')
        }
      } else if (err instanceof Error) {
        setStatusError(err.message)
      } else {
        setStatusError('Failed to update account status.')
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  // --- Handlers: On-chain Notary Authorization / Revocation -------------------
  const handleStartOnChainAction = (user: AdminUser, action: OnChainActionType) => {
    setOnChainTarget({ user, action })
    setOnChainState('idle')
    setOnChainTxHash(null)
    setOnChainError(null)
  }

  const handleExecuteOnChain = async () => {
    if (!onChainTarget || !onChainTarget.user.walletAddress) return

    setOnChainError(null)
    const targetWallet = onChainTarget.user.walletAddress
    const isAuthorize = onChainTarget.action === 'authorize'

    // 1. Check wallet connection
    if (!connectedWallet) {
      try {
        await connect()
      } catch {
        setOnChainState('failed')
        setOnChainError('Please connect your MetaMask wallet to perform this action.')
        return
      }
    }

    // 2. Check network
    if (!isCorrectNetwork) {
      try {
        await switchNetwork()
      } catch {
        setOnChainState('failed')
        setOnChainError('Please switch MetaMask to the expected network.')
        return
      }
    }

    try {
      // 3. Get contract deployment info from backend (no hardcoded address!)
      const contractInfo = await api.get<BlockchainContractResponse>('/blockchain/contract')

      const signer = await getSigner()
      const contract = new ethers.Contract(
        contractInfo.contractAddress,
        contractInfo.abi as ethers.InterfaceAbi,
        signer
      )

      // 4. Verify connected wallet is contract owner
      let ownerAddress: string
      try {
        ownerAddress = await contract.contractOwner()
      } catch {
        setOnChainState('failed')
        setOnChainError('Failed to query contract owner from the blockchain.')
        return
      }

      const connectedAccount = await signer.getAddress()
      if (ownerAddress.toLowerCase() !== connectedAccount.toLowerCase()) {
        setOnChainState('failed')
        setOnChainError('Connect the contract owner (deployer) account.')
        return
      }

      // 5. Trigger MetaMask transaction
      setOnChainState('awaiting-wallet')

      let tx: ethers.ContractTransactionResponse
      if (isAuthorize) {
        tx = await contract.addNotary(targetWallet)
      } else {
        tx = await contract.removeNotary(targetWallet)
      }

      // 6. Transaction submitted, awaiting block confirmation
      setOnChainTxHash(tx.hash)
      setOnChainState('pending')

      const receipt = await tx.wait(1)
      if (!receipt || receipt.status === 0) {
        setOnChainState('failed')
        setOnChainError('Transaction was reverted on the blockchain.')
        return
      }

      // 7. Confirmed on-chain!
      setOnChainState('confirmed')

      // Refetch from backend so onChainAuthorized badge updates from live read
      await fetchData()
    } catch (err: unknown) {
      const ethErr = err as {
        code?: number | string
        message?: string
        reason?: string
        data?: unknown
      }

      const rawMsg = (ethErr.message || ethErr.reason || String(err)).toLowerCase()

      if (
        ethErr.code === 4001 ||
        ethErr.code === 'ACTION_REJECTED' ||
        rawMsg.includes('user rejected') ||
        rawMsg.includes('rejected')
      ) {
        setOnChainState('rejected-by-user')
        setOnChainError('Transaction was rejected in MetaMask.')
      } else if (rawMsg.includes('notcontractowner')) {
        setOnChainState('failed')
        setOnChainError(
          'Connected wallet is not the contract owner. Only the deployer account can authorize or revoke notaries.'
        )
      } else if (rawMsg.includes('notaryalreadyauthorized')) {
        setOnChainState('failed')
        setOnChainError('This notary wallet is already authorized on the smart contract.')
      } else if (rawMsg.includes('notarynotfound')) {
        setOnChainState('failed')
        setOnChainError('This notary wallet is not currently authorized on the smart contract.')
      } else if (rawMsg.includes('invalidaddress')) {
        setOnChainState('failed')
        setOnChainError('Invalid wallet address.')
      } else {
        setOnChainState('failed')
        setOnChainError(ethErr.message || 'Transaction failed on the blockchain.')
      }
    }
  }

  const handleCloseOnChainModal = () => {
    if (onChainState === 'awaiting-wallet' || onChainState === 'pending') {
      return // Don't close while transaction is underway
    }
    setOnChainTarget(null)
    setOnChainState('idle')
    setOnChainTxHash(null)
    setOnChainError(null)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Users className="w-6 h-6 text-primary-400" />
            <span>Manage Users & Notaries</span>
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage system roles, enable/disable accounts, and authorize notary wallets on the blockchain.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={fetchData}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Chain unreachable banner */}
      {!chainAvailable && (
        <Alert type="warning">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">Blockchain Network Offline</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                The blockchain node is currently unreachable. Live on-chain notary authorization status cannot be queried.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Main Error */}
      {error && (
        <Alert type="error">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchData}>
              Try Again
            </Button>
          </div>
        </Alert>
      )}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-surface-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or wallet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-900 border border-surface-700 rounded-xl text-sm text-white placeholder-surface-500 focus:outline-none focus:border-primary-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="role-filter" className="text-xs text-surface-400 whitespace-nowrap">
              Role:
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-surface-900 border border-surface-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 transition"
            >
              <option value="">All Roles</option>
              <option value="USER">USER</option>
              <option value="NOTARY">NOTARY</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-surface-300">
            <thead className="bg-surface-900/60 text-xs text-surface-400 uppercase tracking-wider border-b border-surface-700">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Linked Wallet</th>
                <th className="px-5 py-3">On-Chain Badge</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-800">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-400">
                    <Spinner size="md" />
                    <p className="mt-2 text-xs">Loading user list...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-surface-400">
                    <Users className="w-8 h-8 mx-auto text-surface-600 mb-2" />
                    <p className="text-sm">No matching users found.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentAdmin = u.id === currentAdmin?.id
                  const notaryData = notariesMap.get(u.id)
                  const isNotary = u.role === 'NOTARY'
                  const hasWallet = Boolean(u.walletAddress)
                  const onChainAuthorized = notaryData?.onChainAuthorized

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-surface-800/40 transition ${
                        !u.isActive ? 'opacity-60 bg-surface-950/40' : ''
                      }`}
                    >
                      {/* Name & Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-white flex items-center gap-1.5">
                            {u.name}
                            {isCurrentAdmin && (
                              <span className="text-[10px] font-semibold text-primary-400 bg-primary-500/10 px-1.5 py-0.2 rounded border border-primary-500/20">
                                You
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-surface-400">{u.email}</span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              : u.role === 'NOTARY'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : 'bg-surface-800 text-surface-300 border-surface-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                            u.isActive
                              ? 'text-emerald-400 bg-emerald-500/10'
                              : 'text-red-400 bg-red-500/10'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              u.isActive ? 'bg-emerald-400' : 'bg-red-400'
                            }`}
                          />
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Linked Wallet */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-xs">
                        {u.walletAddress ? (
                          <div className="flex items-center gap-1.5">
                            <span>{formatShortAddress(u.walletAddress)}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(`wallet-${u.id}`, u.walletAddress!)}
                              className="text-surface-400 hover:text-white transition"
                              title="Copy wallet address"
                            >
                              {copiedId === `wallet-${u.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-surface-500 font-sans">None</span>
                        )}
                      </td>

                      {/* On-Chain Badge */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {!isNotary ? (
                          <span className="text-xs text-surface-500">—</span>
                        ) : !hasWallet ? (
                          <span className="text-xs text-surface-500">No wallet linked</span>
                        ) : !chainAvailable ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertCircle className="w-3 h-3" />
                            Unknown
                          </span>
                        ) : onChainAuthorized === true ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" />
                            Authorized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-surface-800 text-surface-400 border border-surface-700">
                            <XCircle className="w-3 h-3 text-surface-500" />
                            Not authorized
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Change Role Button */}
                          <button
                            type="button"
                            disabled={isCurrentAdmin}
                            onClick={() => handleOpenRoleModal(u)}
                            className={`p-1.5 rounded-lg text-xs font-medium transition ${
                              isCurrentAdmin
                                ? 'text-surface-600 cursor-not-allowed'
                                : 'text-surface-300 hover:text-white hover:bg-surface-800 border border-surface-700'
                            }`}
                            title={isCurrentAdmin ? 'Cannot modify your own role' : 'Change role'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            disabled={isCurrentAdmin}
                            onClick={() => handleOpenStatusModal(u)}
                            className={`p-1.5 rounded-lg text-xs font-medium transition ${
                              isCurrentAdmin
                                ? 'text-surface-600 cursor-not-allowed'
                                : u.isActive
                                ? 'text-red-400 hover:bg-red-500/10 border border-surface-700'
                                : 'text-emerald-400 hover:bg-emerald-500/10 border border-surface-700'
                            }`}
                            title={
                              isCurrentAdmin
                                ? 'Cannot disable your own account'
                                : u.isActive
                                ? 'Disable account'
                                : 'Enable account'
                            }
                          >
                            {u.isActive ? (
                              <UserX className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* On-Chain Authorize / Revoke (Only for NOTARY users with linked wallet) */}
                          {isNotary && hasWallet && (
                            <>
                              {onChainAuthorized === true ? (
                                <button
                                  type="button"
                                  onClick={() => handleStartOnChainAction(u, 'revoke')}
                                  className="px-2 py-1 rounded-lg text-xs font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition flex items-center gap-1"
                                  title="Revoke notary authorization on-chain"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Revoke On-Chain</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStartOnChainAction(u, 'authorize')}
                                  className="px-2 py-1 rounded-lg text-xs font-medium text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition flex items-center gap-1"
                                  title="Authorize notary on the smart contract"
                                >
                                  <Shield className="w-3 h-3" />
                                  <span>Authorize On-Chain</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Role Change Modal ──────────────────────────────────────────────── */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="max-w-md w-full p-6 shadow-2xl border-surface-700">
            <h3 className="text-lg font-bold text-white mb-2">Change User Role</h3>
            <p className="text-sm text-surface-300 mb-4">
              Update role for <span className="font-semibold text-white">{roleModalUser.name}</span> ({roleModalUser.email}).
            </p>

            <Alert type="info">
              <div className="text-xs">
                <strong>Important note:</strong> Changing a role does not authorize a wallet on the blockchain.
                On-chain authorization requires a separate transaction by the contract deployer.
              </div>
            </Alert>

            {roleError && (
              <div className="mt-3">
                <Alert type="error">{roleError}</Alert>
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                Select New Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedNewRole('USER')}
                  className={`p-3 rounded-xl border text-sm font-medium transition ${
                    selectedNewRole === 'USER'
                      ? 'border-primary-500 bg-primary-500/10 text-white'
                      : 'border-surface-700 bg-surface-900 text-surface-400 hover:border-surface-600'
                  }`}
                >
                  Regular USER
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedNewRole('NOTARY')}
                  className={`p-3 rounded-xl border text-sm font-medium transition ${
                    selectedNewRole === 'NOTARY'
                      ? 'border-primary-500 bg-primary-500/10 text-white'
                      : 'border-surface-700 bg-surface-900 text-surface-400 hover:border-surface-600'
                  }`}
                >
                  Official NOTARY
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRoleModalUser(null)}
                disabled={updatingRole}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRoleChange}
                disabled={updatingRole}
                className="flex items-center gap-1.5"
              >
                {updatingRole ? <Spinner size="sm" /> : <UserCheck className="w-4 h-4" />}
                <span>Confirm Change</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Status Toggle Modal ────────────────────────────────────────────── */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="max-w-md w-full p-6 shadow-2xl border-surface-700">
            <h3 className="text-lg font-bold text-white mb-2">
              {statusModalUser.isActive ? 'Disable User Account' : 'Enable User Account'}
            </h3>
            <p className="text-sm text-surface-300 mb-4">
              Are you sure you want to {statusModalUser.isActive ? 'disable' : 'enable'} the account for{' '}
              <span className="font-semibold text-white">{statusModalUser.name}</span> ({statusModalUser.email})?
            </p>

            {statusModalUser.isActive && (
              <Alert type="warning">
                <span className="text-xs">
                  Disabling this account immediately invalidates their existing session tokens. The user will be blocked from accessing protected routes.
                </span>
              </Alert>
            )}

            {statusError && (
              <div className="mt-3">
                <Alert type="error">{statusError}</Alert>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusModalUser(null)}
                disabled={updatingStatus}
              >
                Cancel
              </Button>
              <Button
                variant={statusModalUser.isActive ? 'danger' : 'primary'}
                size="sm"
                onClick={handleConfirmStatusToggle}
                disabled={updatingStatus}
                className="flex items-center gap-1.5"
              >
                {updatingStatus ? <Spinner size="sm" /> : null}
                <span>{statusModalUser.isActive ? 'Disable Account' : 'Enable Account'}</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── On-Chain Authorize / Revoke Modal ───────────────────────────────── */}
      {onChainTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="max-w-lg w-full p-6 shadow-2xl border-surface-700">
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`p-2.5 rounded-xl ${
                  onChainTarget.action === 'authorize'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {onChainTarget.action === 'authorize' ? (
                  <Shield className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  {onChainTarget.action === 'authorize'
                    ? 'Authorize Notary On-Chain'
                    : 'Revoke Notary On-Chain'}
                </h3>
                <p className="text-xs text-surface-400">
                  Smart contract function:{' '}
                  <code className="text-primary-300 font-mono">
                    {onChainTarget.action === 'authorize'
                      ? 'addNotary(address)'
                      : 'removeNotary(address)'}
                  </code>
                </p>
              </div>
            </div>

            <div className="space-y-3 my-4 bg-surface-900/60 p-4 rounded-xl border border-surface-800 text-xs text-surface-300">
              <div className="flex justify-between">
                <span className="text-surface-400">Target Notary:</span>
                <span className="font-semibold text-white">{onChainTarget.user.name}</span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <span className="text-surface-400">Notary Wallet:</span>
                <span className="font-mono text-primary-300 break-all text-right">
                  {onChainTarget.user.walletAddress}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Connected Wallet:</span>
                <span className="font-mono text-surface-200">
                  {connectedWallet ? formatShortAddress(connectedWallet) : 'Not connected'}
                </span>
              </div>
            </div>

            {/* Error banner */}
            {onChainError && (
              <div className="mb-4">
                <Alert type="error">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                    <span className="text-xs">{onChainError}</span>
                  </div>
                </Alert>
              </div>
            )}

            {/* State indicators */}
            {onChainState === 'awaiting-wallet' && (
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2 mb-4">
                <Spinner size="sm" />
                <span>Please confirm the transaction in your MetaMask wallet...</span>
              </div>
            )}

            {onChainState === 'pending' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1 mb-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Spinner size="sm" />
                  <span>Transaction submitted to the blockchain. Awaiting block confirmation...</span>
                </div>
                {onChainTxHash && (
                  <p className="font-mono text-[11px] text-surface-300 break-all">
                    Tx: {onChainTxHash}
                  </p>
                )}
              </div>
            )}

            {onChainState === 'confirmed' && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1 mb-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    Successfully {onChainTarget.action === 'authorize' ? 'authorized' : 'revoked'} on the blockchain!
                  </span>
                </div>
                {onChainTxHash && (
                  <p className="font-mono text-[11px] text-surface-300 break-all">
                    Tx: {onChainTxHash}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCloseOnChainModal}
                disabled={onChainState === 'awaiting-wallet' || onChainState === 'pending'}
              >
                {onChainState === 'confirmed' ? 'Close' : 'Cancel'}
              </Button>

              {onChainState !== 'confirmed' && (
                <Button
                  variant={onChainTarget.action === 'authorize' ? 'primary' : 'danger'}
                  size="sm"
                  onClick={handleExecuteOnChain}
                  disabled={
                    onChainState === 'awaiting-wallet' || onChainState === 'pending'
                  }
                  className="flex items-center gap-1.5"
                >
                  {onChainState === 'awaiting-wallet' || onChainState === 'pending' ? (
                    <>
                      <Spinner size="sm" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Confirm {onChainTarget.action === 'authorize' ? 'Authorization' : 'Revocation'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
