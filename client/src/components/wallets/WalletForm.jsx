
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import FormInput from "../ui/FormInput";
import FormSelect from "../ui/FormSelect";
import SubmitButton from "../ui/SubmitButton";

import { walletSchema, walletEditSchema } from "../../validations/finance.schema";

export default function WalletForm({
    wallet = null,
    onSave,
    onCancel,
    loading = false
}) {
    const isEdit = Boolean(wallet);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting }
    } = useForm({
        resolver: zodResolver(isEdit ? walletEditSchema : walletSchema),
        mode: "onTouched",
        defaultValues: {
            name: "",
            type: "CASH",
            openingBalance: "0"
        }
    });

    useEffect(() => {
        reset({
            name: wallet?.name || "",
            type: wallet?.type || "CASH",
            openingBalance: String(wallet?.openingBalance ?? "0")
        });
    }, [wallet, reset]);

    async function handleSave(data) {
        await onSave(data);
    }

    return (
        <form
            onSubmit={handleSubmit(handleSave)}
            noValidate
            className="space-y-5"
        >
            <fieldset disabled={loading || isSubmitting} className="space-y-5">
            <FormInput
                label="Nama Dompet"
                placeholder="Contoh: Dompet Harian"
                required
                {...register("name")}
                error={errors.name?.message}
            />

            <FormSelect
                label="Jenis Dompet"
                required
                options={[
                    { value: "CASH", label: "Tunai" },
                    { value: "BANK", label: "Bank" },
                    { value: "EWALLET", label: "Dompet Digital" },
                    { value: "OTHER", label: "Lainnya" }
                ]}
                {...register("type")}
                error={errors.type?.message}
            />

            {!isEdit && (
                <FormInput
                    label="Saldo Awal (Rp)"
                    placeholder="Contoh: 50000"
                    inputMode="decimal"
                    required
                    {...register("openingBalance")}
                    error={errors.openingBalance?.message}
                />
            )}

            </fieldset>
            <div className="flex gap-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading || isSubmitting}
                    className="h-12 flex-1 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Batal
                </button>

                <div className="flex-1">
                    <SubmitButton loading={loading || isSubmitting}>
                        {isEdit ? "Simpan Perubahan" : "Tambah Dompet"}
                    </SubmitButton>
                </div>
            </div>
        </form>
    );
}
