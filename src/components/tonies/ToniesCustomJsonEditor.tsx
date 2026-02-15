import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Col, Form, Input, Modal, Row, Space, Tooltip, Typography } from "antd";
import type { UploadFile } from "antd";
import { InfoCircleOutlined } from "@ant-design/icons";

import { TonieCardProps } from "../../types/tonieTypes";
import { TeddyCloudApi } from "../../api";
import { defaultAPIConfig } from "../../config/defaultApiConfig";
import { useTeddyCloud } from "../../contexts/TeddyCloudContext";
import { NotificationTypeEnum } from "../../types/teddyCloudNotificationTypes";
import { FileBrowser } from "./filebrowser/FileBrowser";
import { SelectFileFileBrowser } from "./filebrowser/SelectFileFileBrowser";
import UploadFilesModal from "./filebrowser/modals/UploadFilesModal";

const api = new TeddyCloudApi(defaultAPIConfig());

interface ToniesCustomJsonEditorProps {
    open: boolean;
    onClose: () => void;
    setValue?: (value: any) => void;
    props?: any;
    tonieCardProps?: TonieCardProps;
    audioId?: number;
    hash?: string;
}

type AudioPair = { audio_id: string; hash: string };
type TrackRow = { track: string };

type CustomEntry = {
    no?: string;
    model: string;
    audio_id?: string[];
    hash?: string[];
    title?: string;
    series: string;
    episodes?: string;
    tracks?: string[];
    release?: string;
    language?: string;
    category?: string;
    pic?: string;
};

type FormValues = {
    no?: string;
    model: string;
    title?: string;
    series: string;
    episodes?: string;
    release?: string;
    language?: string;
    category?: string;
    pic?: string;
    audioPairs: AudioPair[];
    tracks: TrackRow[];
};

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

const normalizeDirPath = (value: string) => value.replace(/^\/+/, "").replace(/\/+$/, "");

const deriveCustomImgDirectory = (pic?: string): string => {
    if (!pic || !pic.startsWith("/custom_img/")) return "";
    const normalized = pic.slice("/custom_img/".length);
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length <= 1) return "";
    return segments.slice(0, -1).join("/");
};

const toCustomImgWebPath = (path: string, fileName: string) => {
    const normalizedPath = normalizeDirPath(path);
    return normalizedPath ? `/custom_img/${normalizedPath}/${fileName}` : `/custom_img/${fileName}`;
};

const cloneEntry = (entry: CustomEntry): CustomEntry => JSON.parse(JSON.stringify(entry));

const toFormValues = (entry: CustomEntry): FormValues => ({
    no: entry.no ?? "",
    model: entry.model ?? "",
    title: entry.title ?? "",
    series: entry.series ?? "",
    episodes: entry.episodes ?? "",
    release: entry.release ?? "",
    language: entry.language ?? "",
    category: entry.category ?? "",
    pic: entry.pic ?? "",
    audioPairs:
        entry.audio_id && entry.hash
            ? entry.audio_id.map((audio_id, idx) => ({ audio_id: audio_id ?? "", hash: entry.hash?.[idx] ?? "" }))
            : [{ audio_id: "", hash: "" }],
    tracks: entry.tracks && entry.tracks.length > 0 ? entry.tracks.map((track) => ({ track })) : [{ track: "" }],
});

const parseModelId = (model: string): number | null => {
    const match = /^custom-(\d+)$/i.exec(model.trim());
    return match ? Number(match[1]) : null;
};

const buildSuggestedModel = (entries: CustomEntry[]): string => {
    let maxId = 0;
    entries.forEach((entry) => {
        const parsed = parseModelId(entry.model || "");
        if (parsed !== null && parsed > maxId) maxId = parsed;
    });
    return `custom-${maxId + 1}`;
};

const toEntry = (values: FormValues): CustomEntry => {
    const pairs = (values.audioPairs || [])
        .map((pair) => ({
            audio_id: (pair.audio_id || "").trim(),
            hash: (pair.hash || "").trim(),
        }))
        .filter((pair) => pair.audio_id && pair.hash);

    const tracks = (values.tracks || [])
        .map((track) => (track.track || "").trim())
        .filter((track) => track.length > 0);

    const entry: CustomEntry = {
        no: (values.no || "").trim() || undefined,
        model: (values.model || "").trim(),
        audio_id: pairs.length > 0 ? pairs.map((pair) => pair.audio_id) : undefined,
        hash: pairs.length > 0 ? pairs.map((pair) => pair.hash) : undefined,
        title: (values.title || "").trim() || undefined,
        series: (values.series || "").trim(),
        episodes: (values.episodes || "").trim() || undefined,
        tracks: tracks.length > 0 ? tracks : undefined,
        release: (values.release || "").trim() || undefined,
        language: (values.language || "").trim() || undefined,
        category: (values.category || "").trim() || undefined,
        pic: (values.pic || "").trim() || undefined,
    };

    return entry;
};

const isImageFile = (name: string) => IMAGE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));

export const ToniesCustomJsonEditor: React.FC<ToniesCustomJsonEditorProps> = ({
    open,
    onClose,
    setValue,
    props,
    tonieCardProps,
    audioId,
    hash,
}) => {
    const { t } = useTranslation();
    const { addNotification } = useTeddyCloud();
    const [form] = Form.useForm<FormValues>();

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [customEntries, setCustomEntries] = useState<CustomEntry[]>([]);
    const [baseEntries, setBaseEntries] = useState<CustomEntry[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isEditingNewEntry, setIsEditingNewEntry] = useState(true);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerPath, setPickerPath] = useState("");
    const [pickerSelection, setPickerSelection] = useState<string>("");

    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadPath, setUploadPath] = useState("");
    const [uploadFileList, setUploadFileList] = useState<UploadFile<any>[]>([]);
    const [, setUploadRebuild] = useState(false);

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");

    const [imagePathOptions, setImagePathOptions] = useState<string[]>([]);

    const listWithCurrentDraft = async () => {
        const values = await form.validateFields();
        const draft = toEntry(values);
        const next = customEntries.map((entry) => cloneEntry(entry));
        if (isEditingNewEntry) {
            next.push(draft);
            return { next, activeEntry: draft };
        }
        if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= next.length) {
            throw new Error("Invalid selected index");
        }
        next[selectedIndex] = draft;
        return { next, activeEntry: draft };
    };

    const validateEntryList = (entries: CustomEntry[]) => {
        const modelMap = new Map<string, number>();
        const pairMap = new Map<string, string>();

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const modelKey = entry.model.trim().toLowerCase();
            if (modelMap.has(modelKey)) {
                return {
                    error: t("tonies.addNewCustomTonieModal.modelRequired") + ` (Duplicate: ${entry.model})`,
                    baseWarning: "",
                };
            }
            modelMap.set(modelKey, i);

            const audioIds = entry.audio_id || [];
            const hashes = entry.hash || [];
            for (let j = 0; j < Math.min(audioIds.length, hashes.length); j++) {
                const pair = `${audioIds[j]}::${hashes[j].toLowerCase()}`;
                if (pairMap.has(pair)) {
                    return {
                        error: `Duplicate audio_id+hash pair detected: ${audioIds[j]}`,
                        baseWarning: "",
                    };
                }
                pairMap.set(pair, entry.model);
            }
        }

        const baseModelSet = new Set(baseEntries.map((entry) => (entry.model || "").trim().toLowerCase()));
        const baseWarningModels = entries
            .filter((entry) => baseModelSet.has(entry.model.trim().toLowerCase()))
            .map((entry) => entry.model);
        if (baseWarningModels.length > 0) {
            return {
                error: "",
                baseWarning: `Model exists in base tonies.json: ${Array.from(new Set(baseWarningModels)).join(", ")}`,
            };
        }

        return { error: "", baseWarning: "" };
    };

    const resetFormForNewEntry = (seedEntries: CustomEntry[]) => {
        const suggestedModel = buildSuggestedModel(seedEntries);
        const seedAudio = audioId && hash ? [{ audio_id: String(audioId), hash }] : [{ audio_id: "", hash: "" }];

        form.setFieldsValue({
            no: "",
            model: suggestedModel,
            title: "",
            series: tonieCardProps?.tonieInfo?.series || "",
            episodes: tonieCardProps?.tonieInfo?.episode || "",
            release: "",
            language: tonieCardProps?.tonieInfo?.language || "",
            category: "",
            pic: tonieCardProps?.tonieInfo?.picture || "",
            audioPairs: seedAudio,
            tracks: [{ track: "" }],
        });
        setSelectedIndex(null);
        setIsEditingNewEntry(true);
    };

    const loadJsonData = async () => {
        setLoading(true);
        try {
            const [customResponse, baseResponse] = await Promise.all([
                api.apiGetTeddyCloudApiRaw("/api/toniesCustomJson"),
                api.apiGetTeddyCloudApiRaw("/api/toniesJson"),
            ]);

            const [customData, baseData] = await Promise.all([customResponse.json(), baseResponse.json()]);
            const normalizedCustom = Array.isArray(customData) ? customData : [];
            const normalizedBase = Array.isArray(baseData) ? baseData : [];
            setCustomEntries(normalizedCustom);
            setBaseEntries(normalizedBase);

            if (normalizedCustom.length > 0) {
                setSelectedIndex(0);
                setIsEditingNewEntry(false);
                form.setFieldsValue(toFormValues(normalizedCustom[0]));
            } else {
                resetFormForNewEntry(normalizedCustom);
            }
        } catch (error) {
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.addNewCustomTonieModal.failedToCreate"),
                String(error),
                t("tonies.addToniesCustomJsonEntry")
            );
        } finally {
            setLoading(false);
        }
    };

    const collectImagePaths = async () => {
        const queue: string[] = [""];
        const seen = new Set<string>();
        const discovered: string[] = [];

        while (queue.length > 0) {
            const current = queue.shift() || "";
            if (seen.has(current)) continue;
            seen.add(current);

            try {
                const response = await api.apiGetTeddyCloudApiRaw(
                    `/api/fileIndexV2?path=${encodeURIComponent(current)}&special=custom_img`
                );
                if (!response.ok) continue;
                const data = await response.json();
                const files = Array.isArray(data?.files) ? data.files : [];

                files.forEach((entry: any) => {
                    if (!entry || entry.name === "..") return;
                    if (entry.isDir) {
                        const nextPath = current ? `${current}/${entry.name}` : `${entry.name}`;
                        queue.push(nextPath);
                        return;
                    }
                    if (isImageFile(entry.name)) {
                        discovered.push(toCustomImgWebPath(current, entry.name));
                    }
                });
            } catch {
                // ignore and continue with already discovered entries
            }
        }

        setImagePathOptions(Array.from(new Set(discovered)).sort((a, b) => a.localeCompare(b)));
    };

    useEffect(() => {
        if (!open) return;
        void loadJsonData();
        void collectImagePaths();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const selectedModelLabel = useMemo(() => {
        if (isEditingNewEntry) return "(neu)";
        if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= customEntries.length) return "";
        return customEntries[selectedIndex].model;
    }, [customEntries, isEditingNewEntry, selectedIndex]);

    const handleSelectEntry = (idx: number) => {
        if (idx < 0 || idx >= customEntries.length) return;
        setSelectedIndex(idx);
        setIsEditingNewEntry(false);
        form.setFieldsValue(toFormValues(customEntries[idx]));
    };

    const handleApplyEntry = async () => {
        try {
            const values = await form.validateFields();
            const draft = toEntry(values);

            if (isEditingNewEntry) {
                const next = [...customEntries, draft];
                setCustomEntries(next);
                setSelectedIndex(next.length - 1);
                setIsEditingNewEntry(false);
                addNotification(
                    NotificationTypeEnum.Success,
                    t("tonies.addNewCustomTonieModal.successfullyCreated"),
                    t("tonies.addNewCustomTonieModal.successfullyCreatedDetails", {
                        series: draft.series,
                        model: draft.model,
                    }),
                    t("tonies.addToniesCustomJsonEntry")
                );
                return;
            }

            if (selectedIndex === null) return;
            const next = customEntries.map((entry) => cloneEntry(entry));
            next[selectedIndex] = draft;
            setCustomEntries(next);
            addNotification(
                NotificationTypeEnum.Success,
                t("tonies.addNewCustomTonieModal.successfullyCreated"),
                t("tonies.addNewCustomTonieModal.successfullyCreatedDetails", {
                    series: draft.series,
                    model: draft.model,
                }),
                t("tonies.addToniesCustomJsonEntry")
            );
        } catch {
            // form shows errors
        }
    };

    const handleDeleteEntry = () => {
        if (isEditingNewEntry) {
            resetFormForNewEntry(customEntries);
            return;
        }
        if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= customEntries.length) return;
        const next = customEntries.filter((_, idx) => idx !== selectedIndex);
        setCustomEntries(next);
        if (next.length === 0) {
            resetFormForNewEntry(next);
            return;
        }
        const newIndex = Math.min(selectedIndex, next.length - 1);
        handleSelectEntry(newIndex);
    };

    const saveEntries = async (allowBaseOverride: boolean) => {
        const { next, activeEntry } = await listWithCurrentDraft();
        const validation = validateEntryList(next);
        if (validation.error) {
            throw new Error(validation.error);
        }

        if (validation.baseWarning && !allowBaseOverride) {
            return { blockedByBaseWarning: true, message: validation.baseWarning, model: activeEntry.model };
        }

        const response = await api.apiPostTeddyCloudRaw(
            `/api/toniesCustomJsonSet${allowBaseOverride ? "?allowBaseOverride=true" : ""}`,
            JSON.stringify(next),
            undefined,
            undefined,
            { "Content-Type": "application/json" }
        );

        const responseText = await response.text();
        if (!response.ok) {
            if (response.status === 409 && responseText.includes("BASE_OVERRIDE_WARNING") && !allowBaseOverride) {
                return { blockedByBaseWarning: true, message: responseText, model: activeEntry.model };
            }
            throw new Error(responseText || `HTTP ${response.status}`);
        }

        setCustomEntries(next);
        setValue?.(activeEntry.model);
        if (props?.onChange) props.onChange(activeEntry.model);
        return { blockedByBaseWarning: false, message: "", model: activeEntry.model };
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await saveEntries(false);
            if (result.blockedByBaseWarning) {
                Modal.confirm({
                    title: "Base-Override bestaetigen",
                    content: result.message,
                    okText: "Trotzdem speichern",
                    cancelText: t("tonies.informationModal.cancel"),
                    onOk: async () => {
                        try {
                            setSaving(true);
                            await saveEntries(true);
                            addNotification(
                                NotificationTypeEnum.Success,
                                t("tonies.addNewCustomTonieModal.successfullyCreated"),
                                `Gespeichert (mit Base-Override): ${result.model}`,
                                t("tonies.addToniesCustomJsonEntry")
                            );
                            await loadJsonData();
                            await collectImagePaths();
                        } catch (error) {
                            addNotification(
                                NotificationTypeEnum.Error,
                                t("tonies.addNewCustomTonieModal.failedToCreate"),
                                String(error),
                                t("tonies.addToniesCustomJsonEntry")
                            );
                        } finally {
                            setSaving(false);
                        }
                    },
                    onCancel: () => setSaving(false),
                });
                return;
            }

            addNotification(
                NotificationTypeEnum.Success,
                t("tonies.addNewCustomTonieModal.successfullyCreated"),
                `tonies.custom.json gespeichert (${customEntries.length} Eintraege)`,
                t("tonies.addToniesCustomJsonEntry")
            );
            await loadJsonData();
            await collectImagePaths();
        } catch (error) {
            addNotification(
                NotificationTypeEnum.Error,
                t("tonies.addNewCustomTonieModal.failedToCreate"),
                String(error),
                t("tonies.addToniesCustomJsonEntry")
            );
        } finally {
            setSaving(false);
        }
    };

    const handleOpenPicker = () => {
        const pic = form.getFieldValue("pic");
        const initial = deriveCustomImgDirectory(pic);
        setPickerPath(initial);
        setPickerSelection(pic || "");
        setPickerOpen(true);
    };

    const handleOpenUploader = () => {
        const pic = form.getFieldValue("pic");
        const initial = deriveCustomImgDirectory(pic);
        setUploadPath(initial);
        setUploadOpen(true);
    };

    const selectedPic = Form.useWatch("pic", form);

    return (
        <>
            <Modal
                title={t("tonies.addToniesCustomJsonEntry")}
                open={open}
                onCancel={onClose}
                width={Math.max(Math.min(window.innerWidth * 0.92, 1500), 900)}
                footer={
                    <Space>
                        <Button onClick={onClose}>{t("tonies.informationModal.cancel")}</Button>
                        <Button type="primary" loading={saving || loading} onClick={handleSave}>
                            {t("tonies.addNewCustomTonieModal.save")}
                        </Button>
                    </Space>
                }
                destroyOnClose
            >
                <Row gutter={16}>
                    <Col span={11}>
                        <Typography.Title level={5} style={{ marginTop: 0 }}>
                            Bildverwaltung
                        </Typography.Title>
                        <Typography.Paragraph type="secondary">
                            Upload, Ordnerstruktur, Verschieben und Loeschen fuer `/custom_img`.
                        </Typography.Paragraph>
                        <div style={{ border: "1px solid #303030", borderRadius: 8, padding: 8 }}>
                            <FileBrowser special="custom_img" filetypeFilter={IMAGE_EXTENSIONS} trackUrl={false} />
                        </div>
                    </Col>
                    <Col span={13}>
                        <Typography.Title level={5} style={{ marginTop: 0 }}>
                            Modell-Editor {selectedModelLabel ? `- ${selectedModelLabel}` : ""}
                        </Typography.Title>

                        <Space wrap style={{ marginBottom: 8 }}>
                            <Button onClick={() => resetFormForNewEntry(customEntries)}>Neues Modell</Button>
                            <Button onClick={handleApplyEntry}>Eintrag uebernehmen</Button>
                            <Button danger onClick={handleDeleteEntry}>
                                Eintrag loeschen
                            </Button>
                        </Space>

                        <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #303030", borderRadius: 8, padding: 8 }}>
                            <Space wrap>
                                {customEntries.map((entry, idx) => (
                                    <Button
                                        key={`${entry.model}-${idx}`}
                                        type={!isEditingNewEntry && selectedIndex === idx ? "primary" : "default"}
                                        onClick={() => handleSelectEntry(idx)}
                                    >
                                        {entry.model}
                                    </Button>
                                ))}
                            </Space>
                        </div>

                        <Form<FormValues> form={form} layout="vertical" style={{ marginTop: 12 }}>
                            <Row gutter={12}>
                                <Col span={8}>
                                    <Form.Item
                                        label={t("tonies.addNewCustomTonieModal.series")}
                                        name="series"
                                        rules={[
                                            { required: true, message: t("tonies.addNewCustomTonieModal.seriesRequired") },
                                        ]}
                                    >
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item
                                        label={t("tonies.addNewCustomTonieModal.model")}
                                        name="model"
                                        rules={[
                                            { required: true, message: t("tonies.addNewCustomTonieModal.modelRequired") },
                                        ]}
                                    >
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label={t("tonies.addNewCustomTonieModal.episode")} name="episodes">
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={12}>
                                <Col span={24}>
                                    <Form.Item
                                        label={
                                            <>
                                                {t("tonies.addNewCustomTonieModal.pic")}
                                                <Tooltip
                                                    title={
                                                        "Extern: https://example.com/images/biene-maja.png | Lokal: /custom_img/images/custom-tonies/biene-maja-coin.png"
                                                    }
                                                >
                                                    <InfoCircleOutlined style={{ marginLeft: 6 }} />
                                                </Tooltip>
                                            </>
                                        }
                                        name="pic"
                                    >
                                        <Input list="custom-image-options" />
                                    </Form.Item>
                                    <datalist id="custom-image-options">
                                        {imagePathOptions.map((path) => (
                                            <option key={path} value={path} />
                                        ))}
                                    </datalist>
                                    <Space style={{ marginBottom: 12 }}>
                                        <Button onClick={handleOpenPicker}>Bild auswaehlen</Button>
                                        <Button onClick={handleOpenUploader}>Bild hochladen</Button>
                                        <Button
                                            onClick={() => {
                                                const pic = form.getFieldValue("pic");
                                                if (!pic) return;
                                                setPreviewUrl(pic);
                                                setPreviewOpen(true);
                                            }}
                                            disabled={!selectedPic}
                                        >
                                            Vorschau
                                        </Button>
                                    </Space>
                                </Col>
                            </Row>

                            <Row gutter={12}>
                                <Col span={8}>
                                    <Form.Item label={t("tonies.addNewCustomTonieModal.no")} name="no">
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={16}>
                                    <Form.Item label={t("tonies.addNewCustomTonieModal.formfieldTitle")} name="title">
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={12}>
                                <Col span={8}>
                                    <Form.Item label={t("tonies.addNewCustomTonieModal.release")} name="release">
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label={t("tonies.addNewCustomTonieModal.language")} name="language">
                                        <Input />
                                    </Form.Item>
                                </Col>
                                <Col span={8}>
                                    <Form.Item label={t("tonies.addNewCustomTonieModal.category")} name="category">
                                        <Input />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Form.List name="audioPairs">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }, idx) => (
                                            <Row key={key} gutter={12}>
                                                <Col span={8}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, "audio_id"]}
                                                        label={idx === 0 ? t("tonies.addNewCustomTonieModal.audioId") : ""}
                                                    >
                                                        <Input />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={14}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, "hash"]}
                                                        label={idx === 0 ? t("tonies.addNewCustomTonieModal.hash") : ""}
                                                    >
                                                        <Input />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={2}>
                                                    <Button style={{ marginTop: idx === 0 ? 30 : 0 }} onClick={() => remove(name)}>
                                                        -
                                                    </Button>
                                                </Col>
                                            </Row>
                                        ))}
                                        <Button type="dashed" onClick={() => add()} block>
                                            {t("tonies.addNewCustomTonieModal.addAudioIdHash")}
                                        </Button>
                                    </>
                                )}
                            </Form.List>

                            <Form.List name="tracks">
                                {(fields, { add, remove }) => (
                                    <>
                                        {fields.map(({ key, name, ...restField }, idx) => (
                                            <Row key={key} gutter={12} style={{ marginTop: 8 }}>
                                                <Col span={22}>
                                                    <Form.Item
                                                        {...restField}
                                                        name={[name, "track"]}
                                                        label={idx === 0 ? t("tonies.addNewCustomTonieModal.track") : ""}
                                                    >
                                                        <Input />
                                                    </Form.Item>
                                                </Col>
                                                <Col span={2}>
                                                    <Button style={{ marginTop: idx === 0 ? 30 : 0 }} onClick={() => remove(name)}>
                                                        -
                                                    </Button>
                                                </Col>
                                            </Row>
                                        ))}
                                        <Button type="dashed" onClick={() => add()} block>
                                            {t("tonies.addNewCustomTonieModal.addTrack")}
                                        </Button>
                                    </>
                                )}
                            </Form.List>
                        </Form>
                    </Col>
                </Row>
            </Modal>

            <Modal
                title="Bild auswaehlen"
                open={pickerOpen}
                onCancel={() => setPickerOpen(false)}
                onOk={() => {
                    if (pickerSelection) {
                        form.setFieldValue("pic", pickerSelection);
                    }
                    setPickerOpen(false);
                }}
                width={1000}
            >
                <SelectFileFileBrowser
                    special="custom_img"
                    initialPath={pickerPath}
                    filetypeFilter={IMAGE_EXTENSIONS}
                    trackUrl={false}
                    maxSelectedRows={1}
                    onFileSelectChange={(files, path) => {
                        if (files.length !== 1) return;
                        setPickerSelection(toCustomImgWebPath(path, files[0].name));
                    }}
                />
            </Modal>

            <UploadFilesModal
                open={uploadOpen}
                onClose={() => setUploadOpen(false)}
                path={uploadPath}
                special="custom_img"
                uploadFileList={uploadFileList}
                setUploadFileList={setUploadFileList}
                setRebuildList={setUploadRebuild}
                onUploadedFiles={(files, path) => {
                    if (files.length > 0) {
                        form.setFieldValue("pic", toCustomImgWebPath(path, files[0]));
                    }
                    void collectImagePaths();
                }}
            />

            <Modal title="Bildvorschau" open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null}>
                {previewUrl ? <img src={previewUrl} alt="preview" style={{ width: "100%" }} /> : null}
            </Modal>
        </>
    );
};

export default ToniesCustomJsonEditor;
