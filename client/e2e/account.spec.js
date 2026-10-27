import { randomBytes, randomUUID, createHash } from "node:crypto";
import { test, expect, login, shot } from "./fixtures.js";

test("UI-15 Registrasi profil dan perubahan password", async ({ page, fixture: f }) => {
    const email=`${randomUUID()}@example.invalid`;const password=f.password+'Aa1!';
    await page.goto('/register');
    await page.getByLabel('Nama Lengkap',{exact:false}).fill('Pendaftar QA');
    await page.getByLabel('Alamat Email',{exact:false}).fill(email);
    await page.getByLabel('Kata Sandi',{exact:false}).filter({visible:true}).first().fill(password);
    await page.getByLabel('Konfirmasi Kata Sandi',{exact:false}).fill(password);
    await page.getByRole('button',{name:'Buat Akun',exact:true}).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    const user=await f.db.user.findUnique({where:{email}});expect(Boolean(user)).toBe(true);
    await page.goto('/account');await expect(page.getByRole('heading',{name:'Profil Saya',exact:true})).toBeVisible();
    await page.getByLabel('Nama Lengkap',{exact:false}).fill('Ab');await page.getByRole('button',{name:'Simpan Nama',exact:true}).click();
    await expect(page.getByText('Nama minimal 3 karakter.',{exact:true})).toBeVisible();
    await page.getByLabel('Nama Lengkap',{exact:false}).fill('Nama Profil QA');await page.getByRole('button',{name:'Simpan Nama',exact:true}).click();
    await expect.poll(async()=>(await f.db.user.findUnique({where:{id:user.id}})).name).toBe('Nama Profil QA');
    await shot(page,'UI-15-profil');
    const next=randomBytes(24).toString('hex')+'Bb2';
    await page.getByLabel('Kata Sandi Saat Ini',{exact:false}).fill(password);
    await page.getByLabel('Kata Sandi Baru',{exact:false}).first().fill(next);
    await page.getByLabel('Konfirmasi Kata Sandi Baru',{exact:false}).fill(next);
    await page.getByRole('button',{name:'Ubah Kata Sandi',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
    await login(page,{user,password:next});
    await f.db.user.update({where:{id:user.id},data:{passwordHash:null}});
    await page.goto('/account');await expect(page.getByText(/Akun ini masuk melalui Google/)).toBeVisible();
    await expect(page.getByRole('button',{name:'Ubah Kata Sandi',exact:true})).toHaveCount(0);
});

test("UI-16 Lupa dan reset password browser",async({page,fixture:f})=>{
    await page.goto('/login');await page.getByRole('link',{name:'Lupa kata sandi?',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Lupa Kata Sandi',exact:true})).toBeVisible();
    await page.getByLabel('Alamat Email',{exact:false}).fill(f.user.email);await page.getByRole('button',{name:'Kirim Tautan Reset',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Jika akun memenuhi syarat'})).toBeVisible();
    await login(page,f);
    const token=randomBytes(32).toString('hex');await f.db.passwordResetToken.create({data:{userId:f.user.id,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+1800000)}});
    const password=randomBytes(24).toString('hex')+'Aa1';
    await page.goto(`/reset-password?token=${token}`);await expect(page).toHaveURL('http://127.0.0.1:5174/reset-password');
    await page.getByLabel('Kata Sandi Baru',{exact:false}).first().fill(password);await page.getByLabel('Konfirmasi Kata Sandi Baru',{exact:false}).fill(password);
    await page.getByRole('button',{name:'Simpan Kata Sandi Baru',exact:true}).click();
    await expect(page.getByRole('status').filter({hasText:'Kata sandi berhasil direset'})).toBeVisible();
    await page.getByRole('link',{name:'Kembali ke Masuk',exact:true}).click();
    await expect(page.getByRole('button',{name:'Masuk',exact:true})).toBeVisible();
    await login(page,{user:f.user,password});
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel('Kata Sandi Baru',{exact:false}).first().fill(password);await page.getByLabel('Konfirmasi Kata Sandi Baru',{exact:false}).fill(password);
    await page.getByRole('button',{name:'Simpan Kata Sandi Baru',exact:true}).click();await expect(page.getByRole('alert')).toContainText('tidak valid atau kedaluwarsa');
});
