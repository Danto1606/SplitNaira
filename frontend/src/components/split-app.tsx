"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Transaction, StrKey } from "@stellar/stellar-sdk";
import { clsx } from "clsx";
import { z } from "zod";

import {
  buildAllowTokenXdr,
  buildCreateSplitXdr,
  buildDisallowTokenXdr,
  buildDepositXdr,
  buildDistributeXdr,
  buildLockProjectXdr,
  buildUpdateMetadataXdr,
  buildUpdateCollaboratorsXdr,
  getAllSplits,
  getClaimable,
  getProjectHistory,
  getSplit,
  type ProjectHistoryItem,
  getTokenAllowlist,
  type TokenAllowlistState,
  getUnallocatedBalance,
  buildWithdrawUnallocatedXdr,
  type UnallocatedBalanceState,
} from "@/lib/api";
import { isOwner } from "@/lib/address";
import {
  createSorobanRpcServer,
  signWithFreighter,
  submitSorobanTransactionAndPoll,
} from "@/lib/freighter";
import {
  type SplitProject,
  getExplorerUrl,
  getExplorerLabel,
} from "@/lib/stellar";
import { useWallet } from "@/hooks/useWallet";
import { notify } from "@/lib/notification";
import { TokenSelector } from "./TypeSelector";
import {
  TransactionReceiptView,
  type TransactionReceipt,
} from "./TransactionReceiptView";
import { Input } from "./Input";
import { CreateSplitSchema, CreateSplitInput } from "@/lib/schemas";

interface CollaboratorInput {
  id: string;
  address: string;
  alias: string;
  basisPoints: string;
}

interface AllowlistActionResult {
  action: "allow" | "disallow";
  token: string;
  txHash: string | null;
}

const getInitialCollaborators = (): CollaboratorInput[] => [
  { id: "collab-1", address: "", alias: "", basisPoints: "5000" },
  { id: "collab-2", address: "", alias: "", basisPoints: "5000" },
];

const SEEDED_PROJECT_IDS = [
  "afrobeats_001",
  "diaspora_sounds_02",
  "naija_vibes_03",
  "west_african_beats_04",
  "cultural_resonance_05",
];

export function SplitApp() {
  const { wallet, connect, refresh } = useWallet();

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("music");
  const [token, setToken] = useState("");
  const [collaborators, setCollaborators] = useState<CollaboratorInput[]>(
    getInitialCollaborators(),
  );

  const [formErrors, setFormErrors] =
    useState<z.ZodFormattedError<CreateSplitInput> | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [createdProject, setCreatedProject] = useState<SplitProject | null>(
    null,
  );

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "create" | "manage" | "projects"
  >("dashboard");
  const [createStep, setCreateStep] = useState(1);
  const [searchProjectId, setSearchProjectId] = useState("");
  const [fetchedProject, setFetchedProject] = useState<SplitProject | null>(
    null,
  );
  const [isFetchingProject, setIsFetchingProject] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [isDepositing, setIsDepositing] = useState(false);
  const [history, setHistory] = useState<ProjectHistoryItem[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isHistoryStale, setIsHistoryStale] = useState(false);
  const lockModalRef = useRef<HTMLDivElement | null>(null);
  const depositModalRef = useRef<HTMLDivElement | null>(null);

  const [projectsList, setProjectsList] = useState<SplitProject[]>([]);
  const [projectsListLoaded, setProjectsListLoaded] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [isLoadingProjectsList, setIsLoadingProjectsList] = useState(false);
  const [projectsListError, setProjectsListError] = useState<string | null>(
    null,
  );
  const [isProjectsListStale, setIsProjectsListStale] = useState(false);
  const [projectFetchError, setProjectFetchError] = useState<string | null>(
    null,
  );
  const [isProjectStale, setIsProjectStale] = useState(false);

  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editProjectType, setEditProjectType] = useState("music");
  const [isUpdatingMetadata, setIsUpdatingMetadata] = useState(false);

  const [isEditingCollaborators, setIsEditingCollaborators] = useState(false);
  const [editCollaborators, setEditCollaborators] = useState<
    CollaboratorInput[]
  >([]);
  const [isUpdatingCollaborators, setIsUpdatingCollaborators] = useState(false);

  const [dashboardData, setDashboardData] = useState<SplitProject[]>([]);
  const [userEarnings, setUserEarnings] = useState<Record<string, string>>({});
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [dashboardListLoaded, setDashboardListLoaded] = useState(false);
  const [tokenAllowlist, setTokenAllowlist] =
    useState<TokenAllowlistState | null>(null);
  const [allowlistTokenInput, setAllowlistTokenInput] = useState("");
  const [isLoadingAllowlist, setIsLoadingAllowlist] = useState(true);
  const [isUpdatingAllowlist, setIsUpdatingAllowlist] = useState(false);
  const [lastAllowlistTx, setLastAllowlistTx] =
    useState<AllowlistActionResult | null>(null);

  const [recoveryTokenInput, setRecoveryTokenInput] = useState("");
  const [recoveryToInput, setRecoveryToInput] = useState("");
  const [recoveryAmountInput, setRecoveryAmountInput] = useState("");
  const [unallocatedBalance, setUnallocatedBalance] =
    useState<UnallocatedBalanceState | null>(null);
  const [isLoadingUnallocated, setIsLoadingUnallocated] = useState(false);
  const [unallocatedError, setUnallocatedError] = useState<string | null>(null);
  const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false);
  const [isSubmittingRecovery, setIsSubmittingRecovery] = useState(false);
  const [lastRecoveryTxHash, setLastRecoveryTxHash] = useState<string | null>(
    null,
  );

  // Real-time Zod Validation
  useEffect(() => {
    const result = CreateSplitSchema.safeParse({
      projectId,
      title,
      projectType,
      token,
      collaborators,
    });

    if (!result.success) {
      setFormErrors(result.error.format());
    } else {
      setFormErrors(null);
    }
  }, [projectId, title, projectType, token, collaborators]);

  const isValid = !formErrors;

  const totalBasisPoints = useMemo(
    () =>
      collaborators.reduce(
        (sum, c) => sum + (Number.parseInt(c.basisPoints, 10) || 0),
        0,
      ),
    [collaborators],
  );

  const getCollabError = (index: number, field: keyof CollaboratorInput) => {
    return (formErrors?.collaborators as any)?.[index]?.[field]?._errors[0];
  };

  const isStep1Valid = useMemo(() => {
    return (
      projectId.trim() &&
      title.trim() &&
      token.trim() &&
      !formErrors?.projectId &&
      !formErrors?.token
    );
  }, [projectId, title, token, formErrors]);

  const isStep2Valid = useMemo(() => {
    return isValid && collaborators.length >= 2;
  }, [isValid, collaborators.length]);

  const normalizedAllowlistToken = allowlistTokenInput.trim();
  const isValidAllowlistToken = useMemo(
    () =>
      normalizedAllowlistToken.length > 0 &&
      (StrKey.isValidEd25519PublicKey(normalizedAllowlistToken) ||
        StrKey.isValidContract(normalizedAllowlistToken)),
    [normalizedAllowlistToken],
  );

  const isContractAdmin = tokenAllowlist?.admin
    ? isOwner(tokenAllowlist.admin, wallet.address)
    : false;

  const sorobanSplitFlowBusy = isSubmitting || isLocking || isDepositing;

  useEffect(() => {
    let cancelled = false;
    getTokenAllowlist()
      .then((state) => {
        if (!cancelled) setTokenAllowlist(state);
      })
      .catch((error) => {
        console.error("Failed to fetch token allowlist:", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAllowlist(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onConnectWallet() {
    try {
      await connect();
      notify.success("Wallet connected.");
    } catch (error) {
      notify.error("Wallet connection failed.");
    }
  }

  async function onReconnectWallet() {
    try {
      await refresh();
      notify.info(
        wallet.connected ? "Wallet reconnected." : "Wallet not authorized.",
      );
    } catch (error) {
      notify.error("Wallet refresh failed.");
    }
  }

  function onDisconnectWallet() {
    notify.info(
      "Freighter does not support programmatic disconnect. Use the extension to revoke access.",
    );
  }

  async function onInspectUnallocated() {
    if (!recoveryTokenInput.trim()) {
      notify.error("Token address is required.");
      return;
    }
    setIsLoadingUnallocated(true);
    setUnallocatedError(null);
    setUnallocatedBalance(null);
    setShowRecoveryConfirm(false);
    setLastRecoveryTxHash(null);
    try {
      const data = await getUnallocatedBalance(recoveryTokenInput.trim());
      setUnallocatedBalance(data);
    } catch (error) {
      setUnallocatedError(
        error instanceof Error
          ? error.message
          : "Failed to fetch unallocated balance.",
      );
    } finally {
      setIsLoadingUnallocated(false);
    }
  }

  async function onConfirmRecovery() {
    if (!wallet.address || !unallocatedBalance) return;
    const amount = Number(recoveryAmountInput.trim());
    if (!recoveryToInput.trim() || !Number.isFinite(amount) || amount <= 0) {
      notify.error(
        "Destination address and a valid positive amount are required.",
      );
      return;
    }
    setIsSubmittingRecovery(true);
    try {
      const buildResponse = await buildWithdrawUnallocatedXdr({
        admin: wallet.address,
        token: unallocatedBalance.token,
        to: recoveryToInput.trim(),
        amount,
      });
      const signedTxXdr = await signWithFreighter(
        buildResponse.xdr,
        buildResponse.metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        buildResponse.metadata.networkPassphrase,
      );
      const submitResponse = await server.sendTransaction(transaction);
      if (submitResponse.status === "ERROR")
        throw new Error(
          submitResponse.errorResult?.toString() ?? "Transaction failed.",
        );
      setLastRecoveryTxHash(submitResponse.hash ?? null);
      setShowRecoveryConfirm(false);
      notify.success("Recovery transaction submitted successfully.");
      await onInspectUnallocated();
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "Recovery transaction failed.",
      );
    } finally {
      setIsSubmittingRecovery(false);
    }
  }

  async function onUpdateMetadata() {
    if (!fetchedProject || !wallet.address) return;
    if (!editTitle.trim()) {
      notify.error("Title is required.");
      return;
    }
    setIsUpdatingMetadata(true);
    try {
      const buildResponse = await buildUpdateMetadataXdr(
        fetchedProject.projectId,
        wallet.address,
        editTitle.trim(),
        editProjectType.trim(),
      );
      const signedTxXdr = await signWithFreighter(
        buildResponse.xdr,
        buildResponse.metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        buildResponse.metadata.networkPassphrase,
      );
      const submitResponse = await server.sendTransaction(transaction);
      if (submitResponse.status === "ERROR")
        throw new Error(
          submitResponse.errorResult?.toString() ?? "Transaction failed.",
        );
      notify.success("Project metadata updated successfully.");
      setIsEditingMetadata(false);
      await onFetchProject();
    } catch (error) {
      notify.error(
        error instanceof Error ? error.message : "Failed to update metadata.",
      );
    } finally {
      setIsUpdatingMetadata(false);
    }
  }

  async function onUpdateCollaborators() {
    if (!fetchedProject || !wallet.address) return;
    const result =
      CreateSplitSchema.shape.collaborators.safeParse(editCollaborators);
    if (!result.success) {
      notify.error("Please fix collaborator validation errors.");
      return;
    }
    setIsUpdatingCollaborators(true);
    try {
      const buildResponse = await buildUpdateCollaboratorsXdr(
        fetchedProject.projectId,
        wallet.address,
        editCollaborators.map((c) => ({
          address: c.address.trim(),
          alias: c.alias.trim(),
          basisPoints: Number.parseInt(c.basisPoints, 10),
        })),
      );
      const signedTxXdr = await signWithFreighter(
        buildResponse.xdr,
        buildResponse.metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        buildResponse.metadata.networkPassphrase,
      );
      const submitResponse = await server.sendTransaction(transaction);
      if (submitResponse.status === "ERROR")
        throw new Error(
          submitResponse.errorResult?.toString() ?? "Transaction failed.",
        );
      notify.success("Collaborators updated successfully.");
      setIsEditingCollaborators(false);
      await onFetchProject();
    } catch (error) {
      notify.error(
        error instanceof Error
          ? error.message
          : "Failed to update collaborators.",
      );
    } finally {
      setIsUpdatingCollaborators(false);
    }
  }

  function updateCollaborator(id: string, patch: Partial<CollaboratorInput>) {
    setCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function addCollaborator() {
    setCollaborators((prev) => [
      ...prev,
      {
        id: `collab-${Date.now()}-${prev.length}`,
        address: "",
        alias: "",
        basisPoints: "0",
      },
    ]);
  }

  function removeCollaborator(id: string) {
    setCollaborators((prev) =>
      prev.length <= 2 ? prev : prev.filter((c) => c.id !== id),
    );
  }

  function updateEditCollaborator(
    id: string,
    patch: Partial<CollaboratorInput>,
  ) {
    setEditCollaborators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function addEditCollaborator() {
    setEditCollaborators((prev) => [
      ...prev,
      {
        id: `edit-collab-${Date.now()}-${prev.length}`,
        address: "",
        alias: "",
        basisPoints: "0",
      },
    ]);
  }

  function removeEditCollaborator(id: string) {
    setEditCollaborators((prev) =>
      prev.length <= 2 ? prev : prev.filter((c) => c.id !== id),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = CreateSplitSchema.safeParse({
      projectId,
      title,
      projectType,
      token,
      collaborators,
    });
    if (!result.success) {
      setFormErrors(result.error.format());
      notify.error("Please fix the validation errors.");
      return;
    }
    if (!wallet.connected || !wallet.address) {
      notify.error("Connect Freighter wallet first.");
      return;
    }
    setIsSubmitting(true);
    setTxHash(null);
    setReceipt(null);
    try {
      const buildResponse = await buildCreateSplitXdr({
        owner: wallet.address,
        projectId: projectId.trim(),
        title: title.trim(),
        projectType: projectType.trim(),
        token: token.trim(),
        collaborators: collaborators.map((c) => ({
          address: c.address.trim(),
          alias: c.alias.trim(),
          basisPoints: Number.parseInt(c.basisPoints, 10),
        })),
      });
      const signedTxXdr = await signWithFreighter(
        buildResponse.xdr,
        buildResponse.metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        buildResponse.metadata.networkPassphrase,
      );

      await submitSorobanTransactionAndPoll(server, transaction, {
        afterSubmitted: (hash) => {
          setTxHash(hash);
          setReceipt({
            hash,
            lifecycle: "confirming",
            action: "create",
            projectId: projectId.trim(),
            title: title.trim(),
          });
        },
      });

      setReceipt((prev) =>
        prev?.action === "create" && prev.hash
          ? { ...prev, lifecycle: "success" }
          : prev,
      );
      notify.success("Split project created successfully.");
      const projectDetails = await getSplit(projectId.trim());
      setCreatedProject(projectDetails);
      setCreateStep(4);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create split project.";
      setReceipt((prev) =>
        prev?.lifecycle === "confirming" && prev.action === "create"
          ? { ...prev, lifecycle: "failed", failureReason: message }
          : prev,
      );
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function fetchHistory(id: string, cursor?: string) {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const data = await getProjectHistory(id, cursor);
      if (cursor) setHistory((prev) => [...prev, ...data.items]);
      else setHistory(data.items);
      setHistoryCursor(data.nextCursor);
      setIsHistoryStale(false);
    } catch (error) {
      setHistoryError("Failed to fetch history.");
      setIsHistoryStale(history.length > 0);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  const onFetchProject = async () => {
    if (!searchProjectId.trim()) return;
    setIsFetchingProject(true);
    setProjectFetchError(null);
    try {
      const project = await getSplit(searchProjectId.trim());
      setFetchedProject(project);
      setIsEditingCollaborators(false);
      setIsProjectStale(false);
      await fetchHistory(searchProjectId.trim());
    } catch (error) {
      setProjectFetchError("Failed to fetch project.");
      setIsProjectStale(Boolean(fetchedProject));
    } finally {
      setIsFetchingProject(false);
    }
  };

  const onDistribute = async () => {
    if (!fetchedProject || !wallet.address) return;
    setIsSubmitting(true);
    setShowDistributeModal(false);
    try {
      const { xdr, metadata } = await buildDistributeXdr(
        fetchedProject.projectId,
        wallet.address,
      );
      const signedTxXdr = await signWithFreighter(
        xdr,
        metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        metadata.networkPassphrase,
      );

      await submitSorobanTransactionAndPoll(server, transaction, {
        afterSubmitted: (hash) => {
          setTxHash(hash);
          setReceipt({
            hash,
            lifecycle: "confirming",
            action: "distribute",
            projectId: fetchedProject.projectId,
            round: fetchedProject.distributionRound + 1,
          });
        },
      });

      setReceipt((prev) =>
        prev?.action === "distribute" && prev.hash
          ? { ...prev, lifecycle: "success" }
          : prev,
      );
      notify.success("Distribution completed successfully.");
      await onFetchProject();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Distribution failed.";
      setReceipt((prev) =>
        prev?.lifecycle === "confirming" && prev.action === "distribute"
          ? { ...prev, lifecycle: "failed", failureReason: message }
          : prev,
      );
      notify.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Permissions logic
  const isProjectOwner = useMemo(() => {
    if (!fetchedProject || !wallet.address) return false;
    return isOwner(fetchedProject.owner, wallet.address);
  }, [fetchedProject, wallet.address]);

  const canLockProject = useMemo(() => {
    return Boolean(fetchedProject && !fetchedProject.locked && isProjectOwner);
  }, [fetchedProject, isProjectOwner]);

  const onLockProject = async () => {
    if (!fetchedProject || !wallet.address) return;
    setIsLocking(true);
    try {
      const { xdr, metadata } = await buildLockProjectXdr(
        fetchedProject.projectId,
        wallet.address,
      );
      const signedTxXdr = await signWithFreighter(
        xdr,
        metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        metadata.networkPassphrase,
      );

      await submitSorobanTransactionAndPoll(server, transaction, {
        afterSubmitted: (hash) => {
          setTxHash(hash);
          setReceipt({
            hash,
            lifecycle: "confirming",
            action: "lock",
            projectId: fetchedProject.projectId,
          });
        },
      });

      setReceipt((prev) =>
        prev?.action === "lock" && prev.hash
          ? { ...prev, lifecycle: "success" }
          : prev,
      );
      setFetchedProject((prev) => (prev ? { ...prev, locked: true } : prev));
      setShowLockModal(false);
      notify.success("Project locked permanently.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to lock project.";
      setReceipt((prev) =>
        prev?.lifecycle === "confirming" && prev.action === "lock"
          ? { ...prev, lifecycle: "failed", failureReason: message }
          : prev,
      );
      notify.error(message);
    } finally {
      setIsLocking(false);
    }
  };

  const onDeposit = async () => {
    if (!fetchedProject || !wallet.address || !depositAmount) return;
    setIsDepositing(true);
    try {
      const amountInStroops = Math.floor(
        Number.parseFloat(depositAmount) * 10_000_000,
      );
      const { xdr, metadata } = await buildDepositXdr(
        fetchedProject.projectId,
        wallet.address,
        amountInStroops,
      );
      const signedTxXdr = await signWithFreighter(
        xdr,
        metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        metadata.networkPassphrase,
      );

      await submitSorobanTransactionAndPoll(server, transaction, {
        afterSubmitted: (hash) => {
          setTxHash(hash);
          setReceipt({
            hash,
            lifecycle: "confirming",
            action: "deposit",
            projectId: fetchedProject.projectId,
            amount: depositAmount,
          });
        },
      });

      setReceipt((prev) =>
        prev?.action === "deposit" && prev.hash
          ? { ...prev, lifecycle: "success" }
          : prev,
      );
      setShowDepositModal(false);
      setDepositAmount("");
      notify.success("Deposit successful!");
      await onFetchProject();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Deposit failed.";
      setReceipt((prev) =>
        prev?.lifecycle === "confirming" && prev.action === "deposit"
          ? { ...prev, lifecycle: "failed", failureReason: message }
          : prev,
      );
      notify.error(message);
    } finally {
      setIsDepositing(false);
    }
  };

  const onFetchProjectsList = useCallback(async () => {
    setIsLoadingProjectsList(true);
    setProjectsListError(null);
    try {
      const projects: SplitProject[] = [];
      for (const id of SEEDED_PROJECT_IDS) {
        try {
          const project = await getSplit(id);
          projects.push(project);
        } catch (e) {}
      }
      setProjectsList(projects);
      if (projects.length === 0) notify.info("No projects found.");
    } catch (error) {
      setProjectsListError("Failed to fetch projects list.");
    } finally {
      setIsLoadingProjectsList(false);
      setProjectsListLoaded(true);
    }
  }, []);

  const onFetchDashboardData = useCallback(async () => {
    setIsLoadingDashboard(true);
    try {
      const projects = await getAllSplits();
      setDashboardData(projects);
      if (wallet.connected && wallet.address) {
        const earnings: Record<string, string> = {};
        await Promise.all(
          projects
            .filter(
              (p) =>
                p.collaborators.some((c) => c.address === wallet.address) ||
                p.owner === wallet.address,
            )
            .map(async (p) => {
              try {
                const info = await getClaimable(p.projectId, wallet.address!);
                earnings[p.projectId] = String(info.claimed);
              } catch (e) {}
            }),
        );
        setUserEarnings(earnings);
      }
    } catch (error) {
      notify.error("Failed to load dashboard.");
    } finally {
      setIsLoadingDashboard(false);
      setDashboardListLoaded(true);
    }
  }, [wallet.address, wallet.connected]);

  const refreshTokenAllowlist = async () => {
    setIsLoadingAllowlist(true);
    try {
      const state = await getTokenAllowlist();
      setTokenAllowlist(state);
      return state;
    } catch (error) {
      notify.error("Failed to refresh allowlist.");
      return null;
    } finally {
      setIsLoadingAllowlist(false);
    }
  };

  const onSubmitAllowlistAction = async (action: "allow" | "disallow") => {
    if (!wallet.address || !isContractAdmin || !isValidAllowlistToken) return;
    setIsUpdatingAllowlist(true);
    try {
      const buildResponse =
        action === "allow"
          ? await buildAllowTokenXdr(wallet.address, normalizedAllowlistToken)
          : await buildDisallowTokenXdr(
              wallet.address,
              normalizedAllowlistToken,
            );
      const signedTxXdr = await signWithFreighter(
        buildResponse.xdr,
        buildResponse.metadata.networkPassphrase,
      );
      const server = createSorobanRpcServer();
      const transaction = new Transaction(
        signedTxXdr,
        buildResponse.metadata.networkPassphrase,
      );
      const submitResponse = await server.sendTransaction(transaction);
      if (submitResponse.status === "ERROR")
        throw new Error("Allowlist action failed.");
      setLastAllowlistTx({
        action,
        token: normalizedAllowlistToken,
        txHash: submitResponse.hash ?? null,
      });
      setAllowlistTokenInput("");
      notify.success("Allowlist updated.");
      await refreshTokenAllowlist();
    } catch (error) {
      notify.error("Failed to update allowlist.");
    } finally {
      setIsUpdatingAllowlist(false);
    }
  };

  useEffect(() => {
    if (
      activeTab === "projects" &&
      !projectsListLoaded &&
      !isLoadingProjectsList
    )
      void onFetchProjectsList();
    if (
      activeTab === "dashboard" &&
      !dashboardListLoaded &&
      !isLoadingDashboard
    )
      void onFetchDashboardData();
  }, [
    activeTab,
    dashboardListLoaded,
    isLoadingDashboard,
    isLoadingProjectsList,
    onFetchDashboardData,
    onFetchProjectsList,
    projectsListLoaded,
  ]);

  // Modal trapping effects for accessibility
  useEffect(() => {
    if (!showLockModal && !showDepositModal) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowLockModal(false);
        setShowDepositModal(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showLockModal, showDepositModal]);

  return (
    <main className="min-h-screen px-6 py-12 md:px-12 selection:bg-greenBright/10 selection:text-greenBright">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
        {/* Header Section */}
        <header className="glass-card rounded-[2.5rem] p-8 md:p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-1">
              <h1 className="font-display text-4xl tracking-tight text-ink">
                SplitNaira
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-muted">
                Premium royalty management on Stellar.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!wallet.connected ? (
                <button
                  type="button"
                  onClick={onConnectWallet}
                  className="premium-button rounded-full bg-greenMid px-8 py-3 text-sm font-bold text-white shadow-lg"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onReconnectWallet}
                    className="premium-button rounded-full border bg-white/5 px-6 py-3 text-sm"
                  >
                    Sync
                  </button>
                  <button
                    type="button"
                    onClick={onDisconnectWallet}
                    className="premium-button rounded-full border bg-white/5 px-6 py-3 text-sm hover:text-red-400"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </div>
          {wallet.connected && (
            <div className="mt-8 flex flex-wrap gap-8 border-t border-white/5 pt-8 text-[11px] font-bold uppercase tracking-[0.2em] text-muted">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-greenBright animate-pulse" />
                <span>Status: Connected</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="opacity-40">Wallet</span>
                <span className="text-ink font-mono">
                  {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-6)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="opacity-40">Network</span>
                <span className="text-ink">{wallet.network}</span>
              </div>
            </div>
          )}
        </header>

        {/* Navigation Tabs */}
        <nav className="flex gap-1 rounded-full bg-white/5 p-1.5 self-center">
          {["dashboard", "create", "manage", "projects"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={clsx(
                "rounded-full px-8 py-2.5 text-xs font-bold uppercase tracking-widest transition-all",
                activeTab === tab
                  ? "bg-white/10 text-ink shadow-sm"
                  : "text-muted hover:text-ink/80",
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {/* Content Tabs */}
        {activeTab === "dashboard" && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="grid gap-6 md:grid-cols-3">
              {isLoadingDashboard ? (
                Array(3)
                  .fill(0)
                  .map((_, i) => <SummaryCardSkeleton key={i} />)
              ) : (
                <>
                  <div className="glass-card rounded-3xl p-8 border-l-4 border-greenBright">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-2">
                      Total Managed
                    </p>
                    <p className="text-3xl font-display">
                      {dashboardData.length}{" "}
                      <span className="text-sm font-sans text-muted">
                        Projects
                      </span>
                    </p>
                  </div>
                  <div className="glass-card rounded-3xl p-8 border-l-4 border-goldLight">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-2">
                      Platform Treasury
                    </p>
                    <p className="text-3xl font-display text-greenBright">
                      {dashboardData
                        .reduce((s, p) => s + Number(p.balance), 0)
                        .toLocaleString()}{" "}
                      <span className="text-sm font-sans text-muted">
                        Stroops
                      </span>
                    </p>
                  </div>
                  <div className="glass-card rounded-3xl p-8 border-l-4 border-white/20">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted mb-2">
                      Lifetime Payouts
                    </p>
                    <p className="text-3xl font-display">
                      {dashboardData
                        .reduce((s, p) => s + Number(p.totalDistributed), 0)
                        .toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === "create" && (
          <form
            onSubmit={onSubmit}
            className="glass-card rounded-[2.5rem] p-8 md:p-10 space-y-12"
          >
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
              <h2 className="font-display text-2xl tracking-tight">
                Project Setup
              </h2>
              <span className="text-[10px] font-bold uppercase text-muted">
                Step 01 / 02
              </span>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Input
                label="Project Identifier"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                error={formErrors?.projectId?._errors?.[0]}
                placeholder="e.g. nova_01"
                fullWidth
              />
              <Input
                label="Display Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                error={formErrors?.title?._errors?.[0]}
                placeholder="e.g. Dawn of Nova"
                fullWidth
              />
              <TokenSelector
                value={token}
                onChange={setToken}
                network={wallet.network}
                error={formErrors?.token?._errors?.[0]}
              />
              <Input
                label="Media Category"
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                error={formErrors?.projectType?._errors?.[0]}
                placeholder="e.g. Music"
                fullWidth
              />
            </div>

            <div className="mt-12 space-y-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <h2 className="font-display text-2xl tracking-tight">
                  Recipients ({collaborators.length})
                </h2>
                <button
                  type="button"
                  onClick={addCollaborator}
                  className="premium-button rounded-xl bg-greenMid/10 px-4 py-2 text-[10px] font-bold text-greenBright"
                >
                  + Add Recipient
                </button>
              </div>
              <div className="space-y-4">
                {collaborators.map((c, i) => (
                  <div
                    key={c.id}
                    className="group relative grid gap-6 rounded-3xl border border-white/5 bg-white/2 p-6 transition-all md:grid-cols-12 md:items-start"
                  >
                    <div className="md:col-span-5">
                      <Input
                        label="Wallet Address"
                        value={c.address}
                        onChange={(e) =>
                          updateCollaborator(c.id, { address: e.target.value })
                        }
                        error={getCollabError(i, "address")}
                        placeholder="G..."
                        size="sm"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input
                        label="Alias"
                        value={c.alias}
                        onChange={(e) =>
                          updateCollaborator(c.id, { alias: e.target.value })
                        }
                        error={getCollabError(i, "alias")}
                        placeholder="Alias"
                        size="sm"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Input
                        label="Share (BP)"
                        type="number"
                        value={c.basisPoints}
                        onChange={(e) =>
                          updateCollaborator(c.id, {
                            basisPoints: e.target.value,
                          })
                        }
                        error={getCollabError(i, "basisPoints")}
                        placeholder="5000"
                        size="sm"
                      />
                    </div>
                    <div className="md:col-span-1 pt-8 flex justify-center">
                      <button
                        type="button"
                        onClick={() => removeCollaborator(c.id)}
                        className="h-10 w-10 bg-red-500/10 text-red-400 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-end gap-3 px-4 py-6 rounded-3xl bg-white/2 border border-white/5">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] uppercase text-muted">
                    Allocation Matrix
                  </span>
                  <div
                    className={clsx(
                      "rounded-lg px-4 py-2 font-mono text-sm font-bold",
                      totalBasisPoints === 10000
                        ? "bg-greenMid/10 text-greenBright"
                        : "bg-red-500/10 text-red-400",
                    )}
                  >
                    {totalBasisPoints.toLocaleString()} / 10,000 BP
                  </div>
                </div>
                {formErrors?.collaborators &&
                  "_errors" in formErrors.collaborators &&
                  (formErrors.collaborators._errors as string[]).length > 0 && (
                    <p className="text-[10px] font-bold text-red-400 uppercase">
                      {formErrors.collaborators._errors[0]}
                    </p>
                  )}
              </div>
            </div>

            <div className="mt-12 pt-12 border-t border-white/5">
              <button
                type="submit"
                disabled={!isValid || sorobanSplitFlowBusy}
                className="premium-button w-full rounded-4xl bg-greenMid py-5 text-sm font-extrabold uppercase tracking-[0.25em] text-white shadow-2xl shadow-greenMid/20 disabled:cursor-not-allowed disabled:opacity-20"
              >
                {isSubmitting ? (
                  <div className="flex items-center justify-center gap-3">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {receipt?.lifecycle === "confirming" &&
                    receipt.action === "create"
                      ? "Confirming on ledger…"
                      : "Sign in wallet & submit…"}
                  </div>
                ) : (
                  "Create Split Project"
                )}
              </button>
            </div>
            {receipt && receipt.action === "create" && (
              <TransactionReceiptView
                receipt={receipt}
                network={wallet.network}
              />
            )}
          </form>
        )}

        {activeTab === "manage" && (
          <div className="space-y-10">
            <div className="glass-card rounded-[2.5rem] p-8 md:p-10">
              <h2 className="font-display text-2xl tracking-tight mb-8">
                Locate Project
              </h2>
              <div className="flex gap-4">
                <Input
                  value={searchProjectId}
                  onChange={(e) => setSearchProjectId(e.target.value)}
                  placeholder="Enter Project ID"
                  className="flex-1 rounded-2xl"
                />
                <button
                  onClick={onFetchProject}
                  disabled={isFetchingProject || !searchProjectId.trim()}
                  className="premium-button rounded-2xl bg-white px-8 text-[#0a0a09] font-bold"
                >
                  Search
                </button>
              </div>
            </div>

            {fetchedProject && (
              <div className="glass-card rounded-[2.5rem] p-8 md:p-10 animate-in fade-in zoom-in-95 duration-500">
                <div className="flex flex-wrap items-center justify-between gap-6 border-b border-white/5 pb-8">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-3xl">
                        {fetchedProject.title}
                      </h2>
                      <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold text-muted border border-white/5">
                        {fetchedProject.projectType}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-muted opacity-60 break-all">
                      {fetchedProject.projectId}
                    </p>
                  </div>
                  {fetchedProject.locked ? (
                    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-amber-200">
                      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                        <span aria-hidden="true">🔒</span>
                        Split locked - immutable
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {isProjectOwner && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditTitle(fetchedProject.title);
                              setEditProjectType(fetchedProject.projectType);
                              setIsEditingMetadata(true);
                            }}
                            className="premium-button rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-ink transition hover:bg-white/10"
                          >
                            Edit Metadata
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditCollaborators(
                                fetchedProject.collaborators.map((c, i) => ({
                                  id: `edit-collab-${i}`,
                                  address: c.address,
                                  alias: c.alias,
                                  basisPoints: String(c.basisPoints),
                                })),
                              );
                              setIsEditingCollaborators(true);
                            }}
                            className="premium-button rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-ink transition hover:bg-white/10"
                          >
                            Edit Collaborators
                          </button>
                        </>
                      )}
                      {canLockProject && (
                        <button
                          type="button"
                          onClick={() => setShowLockModal(true)}
                          disabled={sorobanSplitFlowBusy}
                          className="premium-button rounded-2xl border border-red-400/30 bg-red-500/10 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Lock Project
                        </button>
                      )}
                    </div>
                  )}
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-muted">
                      Available Funds
                    </p>
                    <p className="text-4xl font-display text-greenBright">
                      {Number(fetchedProject.balance).toLocaleString()}{" "}
                      <span className="text-sm opacity-40">Stroops</span>
                    </p>
                  </div>
                </div>

                <div className="mt-10 grid gap-10 md:grid-cols-2">
                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase text-muted border-l-2 border-greenBright pl-4">
                      Distribution Rules
                    </h3>
                    <div className="space-y-3">
                      {fetchedProject.collaborators.map((collab, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center rounded-2xl bg-white/2 p-4 text-sm border border-white/5"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold">{collab.alias}</p>
                            <p className="font-mono text-[10px] text-muted opacity-60 truncate max-w-[150px]">
                              {collab.address}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-greenBright/80">
                            {(collab.basisPoints / 100).toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-bold uppercase text-muted border-l-2 border-greenBright pl-4">
                      Transparency History
                    </h3>
                    <div className="relative space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {history.map((item) => (
                        <div key={item.id} className="relative pl-10 group">
                          <div
                            className={clsx(
                              "absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0a0a09]",
                              item.type === "round"
                                ? "text-greenBright"
                                : "text-ink/60",
                            )}
                          >
                            {item.type === "round" ? "R" : "P"}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold text-ink">
                                {item.type === "round"
                                  ? `Round #${item.round}`
                                  : "Payout"}
                              </p>
                            </div>
                            <p className="text-[10px] text-muted">
                              <span className="text-ink">
                                {Number(item.amount).toLocaleString()}
                              </span>{" "}
                              Stroops
                            </p>
                            <a
                              href={getExplorerUrl(item.txHash, wallet.network)}
                              target="_blank"
                              className="text-[9px] font-bold text-greenBright/40 hover:text-greenBright uppercase"
                            >
                              Verify →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setShowDistributeModal(true)}
                      disabled={
                        Number(fetchedProject.balance) <= 0 ||
                        !wallet.connected ||
                        sorobanSplitFlowBusy
                      }
                      className="premium-button w-full rounded-2xl bg-greenBright py-6 text-xs font-black uppercase text-[#0a0a09] shadow-xl"
                    >
                      Trigger Distribution
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "projects" && (
          <div className="space-y-10">
            {selectedProjectId === null ? (
              <div className="space-y-8">
                <div className="glass-card rounded-[2.5rem] p-8 md:p-10">
                  <h2 className="font-display text-2xl tracking-tight mb-2">
                    Available Projects
                  </h2>
                  <button
                    onClick={onFetchProjectsList}
                    disabled={isLoadingProjectsList}
                    className="premium-button rounded-2xl bg-greenMid px-8 py-4 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-20"
                  >
                    Refresh Projects
                  </button>
                </div>
                <div className="grid gap-6 md:grid-cols-2 animate-in fade-in">
                  {projectsList.map((p) => (
                    <button
                      key={p.projectId}
                      onClick={() => {
                        setSelectedProjectId(p.projectId);
                        setFetchedProject(p);
                        fetchHistory(p.projectId);
                      }}
                      className="glass-card rounded-[2.5rem] p-8 text-left hover:bg-white/5 transition-all"
                    >
                      <h3 className="font-display text-xl mb-1">{p.title}</h3>
                      <p className="font-mono text-[10px] text-muted mb-4">
                        {p.projectId}
                      </p>
                      <div className="flex justify-between border-t border-white/5 pt-4">
                        <span className="text-xl font-display text-greenBright">
                          {Number(p.balance).toLocaleString()}
                        </span>
                        <span className="text-[10px] uppercase text-muted">
                          Available
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : fetchedProject ? (
              <div className="space-y-8">
                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                    setFetchedProject(null);
                  }}
                  className="premium-button flex items-center gap-2 rounded-2xl bg-white/5 px-6 py-3 text-sm font-bold uppercase tracking-widest text-muted hover:text-ink hover:bg-white/10 transition-all"
                >
                  Back to Projects
                </button>
                {/* Same detailed view as manage tab... */}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Distribution Modal */}
      {showDistributeModal && fetchedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0a0a09]/80 backdrop-blur-xl animate-in fade-in">
          <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl">
            <h2 className="font-display text-3xl mb-2">Final Confirmation</h2>
            <p className="text-muted text-sm mb-8 leading-relaxed">
              Splitting{" "}
              <span className="text-ink font-bold">
                {Number(fetchedProject.balance).toLocaleString()} stroops
              </span>{" "}
              across{" "}
              <span className="text-ink font-bold">
                {fetchedProject.collaborators.length} collaborators
              </span>
              .
            </p>

            <div className="space-y-3 max-h-75 overflow-y-auto pr-2 custom-scrollbar">
              {fetchedProject.collaborators.map((collab, idx) => {
                const amount = Math.floor(
                  (Number(fetchedProject.balance) * collab.basisPoints) /
                    10_000,
                );
                return (
                  <div
                    key={idx}
                    className="flex justify-between items-center rounded-2xl bg-white/5 p-5 border border-white/5"
                  >
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm">{collab.alias}</p>
                      <p className="text-[10px] text-muted uppercase tracking-widest">
                        {(collab.basisPoints / 100).toFixed(2)}% Share
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg text-greenBright">
                        +{amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted uppercase tracking-tighter">
                        Stroops
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 flex flex-col gap-4">
              <button
                onClick={onDistribute}
                disabled={sorobanSplitFlowBusy}
                className="premium-button w-full rounded-2xl bg-greenBright py-5 text-xs font-black uppercase tracking-[0.3em] text-[#0a0a09]"
              >
                {isSubmitting
                  ? receipt?.lifecycle === "confirming" &&
                    receipt.action === "distribute"
                    ? "Confirming on ledger…"
                    : "Signing & submitting…"
                  : "Execute Payout"}
              </button>
              <button
                onClick={() => setShowDistributeModal(false)}
                disabled={sorobanSplitFlowBusy}
                className="premium-button w-full rounded-2xl border border-white/10 py-5 text-xs font-bold uppercase tracking-[0.2em] text-muted hover:text-ink hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Metadata Edit Modal */}
      {isEditingMetadata && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10">
            <h2 className="font-display text-2xl mb-8">
              Edit Project Metadata
            </h2>
            <div className="space-y-6">
              <Input
                label="Project Title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                fullWidth
              />
              <Input
                label="Category"
                value={editProjectType}
                onChange={(e) => setEditProjectType(e.target.value)}
                fullWidth
              />
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsEditingMetadata(false)}
                  className="flex-1 rounded-2xl border border-white/10 px-6 py-4 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={onUpdateMetadata}
                  disabled={isUpdatingMetadata || !editTitle.trim()}
                  className="flex-1 premium-button rounded-2xl bg-white px-6 py-4 text-xs font-bold text-[#0a0a09]"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lock Modal */}
      {showLockModal && fetchedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a09]/80 p-6 backdrop-blur-xl">
          <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl">
            <h2 className="font-display text-3xl">Lock project?</h2>
            <div className="mt-6 rounded-2xl border border-red-400/40 bg-red-500/10 p-4">
              <p className="text-sm font-semibold text-red-200">
                Once locked, the split configuration can never be changed.
              </p>
            </div>
            <div className="mt-10 flex flex-col gap-4">
              <button
                onClick={onLockProject}
                disabled={sorobanSplitFlowBusy}
                className="premium-button w-full rounded-2xl bg-red-500 py-5 text-xs font-black uppercase tracking-[0.3em] text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLocking
                  ? receipt?.lifecycle === "confirming" &&
                    receipt.action === "lock"
                    ? "Confirming on ledger…"
                    : "Signing & locking…"
                  : "Lock Project"}
              </button>
              <button
                onClick={() => setShowLockModal(false)}
                disabled={sorobanSplitFlowBusy}
                className="premium-button w-full rounded-2xl border border-white/10 py-5 text-xs font-bold uppercase tracking-[0.2em] text-muted hover:bg-white/5 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SummaryCardSkeleton() {
  return <div className="h-32 w-full animate-pulse rounded-3xl bg-white/5" />;
}
