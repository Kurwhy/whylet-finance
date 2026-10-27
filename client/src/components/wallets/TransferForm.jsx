import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transferSchema } from "../../validations/finance.schema";
import { formatRupiah } from "../../utils/format";
import FormInput from "../ui/FormInput";
import FormSelect from "../ui/FormSelect";
import SubmitButton from "../ui/SubmitButton";

export default function TransferForm({ initialValues, wallets, loading, uncertain, onSave }) {
    const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(transferSchema), defaultValues: initialValues, mode: "onTouched"
    });
    const sourceId = useWatch({ control, name: "fromWalletId" });
    return <form noValidate onSubmit={handleSubmit(onSave)} className="space-y-4">
        <fieldset disabled={loading || isSubmitting || uncertain} className="space-y-4">
            <FormSelect label="Dompet Asal" required {...register("fromWalletId")} error={errors.fromWalletId?.message}
                options={wallets.map(w => ({ value: w.id, label: `${w.name} — ${formatRupiah(w.balance)}` }))} />
            <FormSelect label="Dompet Tujuan" required {...register("toWalletId")} error={errors.toWalletId?.message}
                options={wallets.filter(w => w.id !== sourceId).map(w => ({ value: w.id, label: w.name }))} />
            <div className="grid gap-3 sm:grid-cols-2">
                <FormInput label="Nominal (Rp)" inputMode="decimal" required {...register("amount")} error={errors.amount?.message} />
                <FormInput label="Biaya Admin (Rp)" inputMode="decimal" required {...register("fee")} error={errors.fee?.message} />
            </div>
            <FormInput label="Tanggal Transfer" type="date" required {...register("transferDate")} error={errors.transferDate?.message} />
            <FormInput label="Catatan (Opsional)" {...register("note")} error={errors.note?.message} />
        </fieldset>
        <SubmitButton loading={loading || isSubmitting}>{uncertain ? "Periksa Ulang Transfer" : "Konfirmasi Transfer"}</SubmitButton>
    </form>;
}
