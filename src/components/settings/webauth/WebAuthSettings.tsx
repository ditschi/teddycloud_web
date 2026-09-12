import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Divider, Flex, Form, Input, Switch, Table, Typography } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";

import ConfirmationDialog from "../../common/modals/ConfirmationModal";
import { useAuth } from "../../../provider/AuthProvider";
import {
    changeAuthPassword,
    createAuthUser,
    deleteAuthUser,
    fetchAuthUsers,
    setAuthEnabled,
} from "../../../utils/auth/webAuthApi";

const { Title, Paragraph, Text } = Typography;

export const WebAuthSettings = () => {
    const { t } = useTranslation();
    const { refresh, username: currentUsername } = useAuth();
    const [users, setUsers] = useState<string[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [envOverride, setEnvOverride] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [createForm] = Form.useForm();
    const [passwordForm] = Form.useForm();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchAuthUsers();
            setUsers(data.users);
            setEnabled(data.enabled);
            setEnvOverride(data.envOverride);
        } catch (err) {
            setError(err instanceof Error ? err.message : t("settings.webAuth.loadFailed"));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const handleToggle = async (checked: boolean) => {
        setError(null);
        try {
            await setAuthEnabled(checked);
            setEnabled(checked);
            await refresh();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("settings.webAuth.saveFailed"));
        }
    };

    const handleCreate = async (values: { username: string; password: string }) => {
        setError(null);
        try {
            await createAuthUser(values.username.trim(), values.password);
            createForm.resetFields();
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("settings.webAuth.saveFailed"));
        }
    };

    const handlePassword = async (values: { username: string; password: string }) => {
        setError(null);
        try {
            await changeAuthPassword(values.username, values.password);
            passwordForm.resetFields(["password"]);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : t("settings.webAuth.saveFailed"));
        }
    };

    const confirmDelete = async () => {
        if (!userToDelete) {
            return;
        }
        setError(null);
        try {
            const result = await deleteAuthUser(userToDelete);
            setUserToDelete(null);
            await load();
            await refresh();
            if (result.authDisabled) {
                setEnabled(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : t("settings.webAuth.saveFailed"));
        }
    };

    const lastUser = users.length === 1;

    return (
        <>
            <Title level={2}>{t("settings.webAuth.title")}</Title>
            <Paragraph>{t("settings.webAuth.intro")}</Paragraph>
            {envOverride ? (
                <Alert
                    type="warning"
                    showIcon
                    title={t("settings.webAuth.envOverride")}
                    style={{ marginBottom: 16 }}
                />
            ) : null}
            {error ? (
                <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
            ) : null}

            <Flex align="center" gap={12} style={{ marginBottom: 24 }}>
                <Switch
                    checked={enabled}
                    disabled={envOverride || (users.length === 0 && !enabled)}
                    onChange={handleToggle}
                />
                <Text>{t("settings.webAuth.enabled")}</Text>
            </Flex>
            {users.length === 0 ? (
                <Alert
                    type="info"
                    showIcon
                    title={t("settings.webAuth.createFirstUser")}
                    style={{ marginBottom: 16 }}
                />
            ) : null}

            <Title level={4}>{t("settings.webAuth.users")}</Title>
            <Table
                loading={loading}
                pagination={false}
                rowKey="username"
                dataSource={users.map((username) => ({ username }))}
                columns={[
                    { title: t("auth.username"), dataIndex: "username" },
                    {
                        title: "",
                        key: "actions",
                        width: 72,
                        render: (_: unknown, record: { username: string }) => (
                            <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => setUserToDelete(record.username)}
                                aria-label={t("settings.webAuth.deleteUser")}
                            />
                        ),
                    },
                ]}
                style={{ marginBottom: 24 }}
            />

            <Title level={4}>{t("settings.webAuth.addUser")}</Title>
            <Form
                form={createForm}
                layout="vertical"
                onFinish={handleCreate}
                style={{ maxWidth: 420 }}
            >
                <Form.Item
                    name="username"
                    label={t("auth.username")}
                    rules={[{ required: true, message: t("auth.usernameRequired") }]}
                >
                    <Input autoComplete="off" style={{ minHeight: 44 }} />
                </Form.Item>
                <Form.Item
                    name="password"
                    label={t("auth.password")}
                    rules={[
                        { required: true, message: t("auth.passwordRequired") },
                        { min: 4, message: t("auth.passwordMin") },
                    ]}
                >
                    <Input.Password autoComplete="new-password" style={{ minHeight: 44 }} />
                </Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    icon={<PlusOutlined />}
                    style={{ minHeight: 44 }}
                >
                    {t("settings.webAuth.addUser")}
                </Button>
            </Form>

            {users.length > 0 ? (
                <>
                    <Divider />
                    <Title level={4}>{t("settings.webAuth.changePassword")}</Title>
                    <Form
                        form={passwordForm}
                        layout="vertical"
                        onFinish={handlePassword}
                        initialValues={{ username: currentUsername || users[0] }}
                        style={{ maxWidth: 420 }}
                    >
                        <Form.Item
                            name="username"
                            label={t("auth.username")}
                            rules={[{ required: true }]}
                        >
                            <Input style={{ minHeight: 44 }} />
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label={t("auth.newPassword")}
                            rules={[
                                { required: true, message: t("auth.passwordRequired") },
                                { min: 4, message: t("auth.passwordMin") },
                            ]}
                        >
                            <Input.Password autoComplete="new-password" style={{ minHeight: 44 }} />
                        </Form.Item>
                        <Button htmlType="submit" style={{ minHeight: 44 }}>
                            {t("settings.webAuth.changePassword")}
                        </Button>
                    </Form>
                </>
            ) : null}

            <ConfirmationDialog
                title={
                    lastUser
                        ? t("settings.webAuth.deleteLastTitle")
                        : t("settings.webAuth.deleteTitle")
                }
                okText={t("settings.webAuth.deleteUser")}
                cancelText={t("common.cancel")}
                content={
                    lastUser
                        ? t("settings.webAuth.deleteLastContent", { username: userToDelete || "" })
                        : t("settings.webAuth.deleteContent", { username: userToDelete || "" })
                }
                contentHint={lastUser ? t("settings.webAuth.deleteLastHint") : undefined}
                open={!!userToDelete}
                handleOk={confirmDelete}
                handleCancel={() => setUserToDelete(null)}
            />
        </>
    );
};
