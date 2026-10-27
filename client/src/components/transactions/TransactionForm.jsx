import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema } from "../../validations/finance.schema";
import FormInput from "../ui/FormInput";
import FormSelect from "../ui/FormSelect";
import SubmitButton from "../ui/SubmitButton";

export default function TransactionForm({ initialValues, wallets, categories, loading, onSave, onCategory }) {
    const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm({
        resolver: zodResolver(transactionSchema), defaultValues: initialValues, mode: "onTouched"
    });
    const type = useWatch({ control, name: "type" });
    const selectedCategories = categories.filter(c => !c.isArchived && c.type === type);
    async function submit(data) {
        if (!wallets.some(w => w.id === data.walletId)) return;
        if (!selectedCategories.some(c => c.id === data.categoryId)) {
            setValue("categoryId", "", { shouldValidate: true });
            return;
        }
        await onSave(data);
    }
    return <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <fieldset disabled={loading || isSubmitting} className="space-y-4">
            <FormSelect label="Jenis Transaksi" required {...register("type", {
                onChange: () => setValue("categoryId", "")
            })} options={[{ value: "EXPENSE", label: "Pengeluaran" }, { value: "INCOME", label: "Pemasukan" }]} error={errors.type?.message} />
            <FormInput label="Nominal (Rp)" inputMode="decimal" required {...register("amount")} error={errors.amount?.message} />
            <FormInput label="Keterangan" required {...register("description")} error={errors.description?.message} />
            <FormSelect label="Dompet" required {...register("walletId")} options={wallets.map(w => ({ value: w.id, label: w.name }))} error={errors.walletId?.message} />
            <FormSelect label="Kategori" required {...register("categoryId")} options={selectedCategories.map(c => ({ value: c.id, label: c.name }))} error={errors.categoryId?.message} />
            <button type="button" onClick={() => onCategory(type)} className="text-sm font-semibold text-emerald-700">Tambah Kategori</button>
            <FormInput label="Tanggal Transaksi" type="date" required {...register("transactionDate")} error={errors.transactionDate?.message} />
        </fieldset>
        <SubmitButton loading={loading || isSubmitting}>Simpan Transaksi</SubmitButton>
    </form>;
}
