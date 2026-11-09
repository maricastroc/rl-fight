import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { buildDocx, buildXlsx, encodeWindows1252 } from "../tests/helpers/ooxml";
import { CLASS_DOCX, MIME, downloadBytes, upload } from "./helpers";

const nameInputs = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: /^Nome do aluno \d+$/ });

test("imports a Word list, edits it and downloads every certificate", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => message.type() === "error" && consoleErrors.push(message.text()));
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Da lista ao certificado.");

  await upload(page, "alunos-aptos.docx", await buildDocx(CLASS_DOCX), MIME.docx);
  const result = page.getByRole("region", { name: "Resultado da importação" });
  await expect(result).toContainText("alunos-aptos.docx");
  await expect(result).toContainText("O resumo de kruangs confere: 6 pedidos para 6 alunos.");
  await expect(result).toContainText("Azul-claro ponteira azul-escura");

  await page.getByRole("button", { name: "Conferir alunos" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confira os alunos.");
  await expect(nameInputs(page)).toHaveCount(6);

  const first = page.getByRole("textbox", { name: "Nome do aluno 1" });
  await first.fill("CAIO DOS REIS LUZ");
  await first.press("Enter");
  await expect(first).toHaveValue("CAIO DOS REIS LUZ");

  await page.getByRole("button", { name: "Adicionar aluno" }).click();
  await page.getByRole("textbox", { name: "Nome completo do aluno" }).fill("Zuleica Prado");
  await page.getByRole("combobox", { name: "Graduação do novo aluno" }).click();
  await page.getByRole("option", { name: "Roxa", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(nameInputs(page)).toHaveCount(7);
  await expect(page.getByRole("heading", { name: "Roxa", level: 2 })).toBeVisible();

  await page.getByRole("button", { name: "Remover LÍVIA BRANDÃO" }).click();
  await page.getByRole("button", { name: "Confirmar remoção de LÍVIA BRANDÃO" }).click();
  await expect(nameInputs(page)).toHaveCount(6);

  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dados do exame.");
  await page.getByRole("button", { name: "Ver certificados" }).click();
  await expect(page.getByText("Informe a data do exame")).toBeVisible();
  await page.getByLabel(/^Data em que o exame/).fill("2026-11-28");
  await expect(page.getByText("sábado, 28 de novembro de 2026")).toBeVisible();
  await page.getByLabel("Cidade").fill("Sobral");
  await expect(page.getByText("Sobral/Ceará")).toBeVisible();
  await page.getByRole("button", { name: "Ver certificados" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pronto para imprimir.");
  await expect(page.getByRole("img", { name: /^Certificado de Caio dos Reis Luz/ })).toBeVisible();
  await page.getByRole("button", { name: "Próximo certificado" }).click();
  await expect(page.getByRole("img", { name: /^Certificado de Débora Ramalho Teixeira/ })).toBeVisible();

  const [single] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Baixar este certificado" }).click()]);
  expect(single.suggestedFilename()).toBe("certificado-debora-ramalho-teixeira.pdf");
  expect((await PDFDocument.load(await downloadBytes(single))).getPageCount()).toBe(1);

  await page.getByRole("button", { name: "Gerar os 6 certificados" }).click();
  await expect(page.getByRole("heading", { name: /6 certificados/ })).toBeVisible({ timeout: 30_000 });

  const [zipDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Baixar ZIP/ }).click()]);
  expect(zipDownload.suggestedFilename()).toBe("certificados-2026-11-28.zip");
  const zip = await JSZip.loadAsync(await downloadBytes(zipDownload));
  expect(Object.keys(zip.files).sort()).toEqual([
    "certificado-ana-cecilia-vasconcelos-torres-pinheiro.pdf",
    "certificado-caio-dos-reis-luz.pdf",
    "certificado-debora-ramalho-teixeira.pdf",
    "certificado-otavio-mendes-arruda.pdf",
    "certificado-tulio-angelo.pdf",
    "certificado-zuleica-prado.pdf",
  ]);

  const [printDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /PDF único para impressão/ }).click()]);
  expect((await PDFDocument.load(await downloadBytes(printDownload))).getPageCount()).toBe(6);
  expect(consoleErrors).toEqual([]);
});

test("filters the preview by graduation and generates only that graduation", async ({ page }) => {
  await page.goto("./");
  await upload(page, "alunos-aptos.docx", await buildDocx(CLASS_DOCX), MIME.docx);
  await page.getByRole("button", { name: "Conferir alunos" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/^Data em que o exame/).fill("2026-11-28");
  await page.getByRole("button", { name: "Ver certificados" }).click();

  const list = page.getByRole("list", { name: "Alunos" });
  await expect(list.getByRole("button")).toHaveCount(6);
  await page.getByRole("combobox", { name: "Filtrar por graduação" }).click();
  await page.getByRole("option", { name: "Vermelha", exact: true }).click();

  await expect(list.getByRole("button")).toHaveCount(2);
  await expect(page.getByText("Aluno 1 de 2 · Vermelha")).toBeVisible();
  await expect(page.getByRole("img", { name: /^Certificado de Otávio Mendes Arruda/ })).toBeVisible();
  await page.getByRole("button", { name: "Próximo certificado" }).click();
  await expect(page.getByRole("img", { name: /^Certificado de Lívia Brandão/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Próximo certificado" })).toBeDisabled();

  await page.getByRole("button", { name: "Gerar só os 2 de Vermelha" }).click();
  await expect(page.getByRole("heading", { name: /2 certificados/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Concluído em .* · Vermelha/)).toBeVisible();
  const [zipDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Baixar ZIP/ }).click()]);
  expect(zipDownload.suggestedFilename()).toBe("certificados-2026-11-28-vermelha.zip");
  const zip = await JSZip.loadAsync(await downloadBytes(zipDownload));
  expect(Object.keys(zip.files).sort()).toEqual(["certificado-livia-brandao.pdf", "certificado-otavio-mendes-arruda.pdf"]);
});

test("blocks generation until a student without graduation is fixed", async ({ page }) => {
  await page.goto("./");
  const csv = "Nome;Graduação\nAna Paula Reis;Vermelha\nBruno Teles;Azul\nCarla Dias;Roxa\n";
  await upload(page, "turma.csv", new TextEncoder().encode(csv), MIME.csv);
  await expect(page.getByRole("region", { name: "Resultado da importação" })).toContainText("“Azul” não corresponde");
  await page.getByRole("button", { name: "Conferir alunos" }).click();

  await expect(page.getByText(/Escolha a graduação \(no arquivo: “Azul”\)/)).toBeVisible();
  const proceed = page.getByRole("button", { name: "Continuar" });
  await expect(proceed).toBeDisabled();

  await page.getByRole("combobox", { name: "Graduação de Bruno Teles" }).click();
  await page.getByRole("option", { name: "Azul-escura", exact: true }).click();
  await expect(proceed).toBeEnabled();
});

test("lets the teacher pick the sheet of a workbook and keeps accents from Windows-1252 CSV", async ({ page }) => {
  await page.goto("./");
  const workbook = await buildXlsx([
    { name: "Instruções", rows: [["Use a aba Turma"]] },
    { name: "Turma", rows: [["Aluno", "Faixa"], ["Íris Araújo", "Marrom"], ["Otávio Brandão", "Preta"]] },
    { name: "Anterior", rows: [["VERMELHA"], ["1. Tânia Lemos"]] },
  ]);
  await upload(page, "turmas.xlsx", workbook, MIME.xlsx);
  const result = page.getByRole("region", { name: "Resultado da importação" });
  await expect(page.getByRole("tab", { name: /Turma/ })).toHaveAttribute("aria-selected", "true");
  await expect(result).toContainText("Marrom");
  await page.getByRole("tab", { name: /Anterior/ }).click();
  await expect(result).toContainText("Vermelha");
  await expect(result).not.toContainText("Marrom");

  await page.getByRole("button", { name: "Trocar arquivo" }).click();
  await upload(page, "excel.csv", encodeWindows1252("Aluno;Faixa\r\nCéSAR PEÇANHA;Roxa\r\n"), MIME.csv);
  await page.getByRole("button", { name: "Conferir alunos" }).click();
  await expect(page.getByRole("textbox", { name: "Nome do aluno 1" })).toHaveValue("CéSAR PEÇANHA");
});

test("explains files that cannot be read", async ({ page }) => {
  await page.goto("./");
  await upload(page, "certificado.pdf", new TextEncoder().encode("%PDF-1.7"), MIME.pdf);
  await expect(page.getByRole("alert").filter({ hasText: "Não deu para ler este arquivo" })).toContainText("Formato não suportado");
  await page.getByRole("button", { name: "Tentar outro arquivo" }).click();
  await expect(page.getByRole("button", { name: "Escolher o arquivo com a lista de alunos" })).toBeVisible();
});

test("offers to resume the list after the page is reloaded", async ({ page }) => {
  await page.goto("./");
  await upload(page, "alunos-aptos.docx", await buildDocx(CLASS_DOCX), MIME.docx);
  await page.getByRole("button", { name: "Conferir alunos" }).click();
  const first = page.getByRole("textbox", { name: "Nome do aluno 1" });
  await first.fill("CAIO VALENTE");
  await first.press("Enter");
  await page.waitForTimeout(400);

  await page.reload();
  await expect(page.getByText("Você tem uma lista em andamento")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("textbox", { name: "Nome do aluno 1" })).toHaveValue("CAIO VALENTE");
});

test("calibrates a field from the keyboard and restores the default", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: /Começar uma lista vazia/ }).click();
  await page.getByRole("textbox", { name: "Nome completo do aluno" }).fill("Helena Prado");
  await page.getByRole("combobox", { name: "Graduação do novo aluno" }).click();
  await page.getByRole("option", { name: "Vermelha", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("button", { name: "Ajustar posições" }).click();
  const dialog = page.getByRole("dialog", { name: "Ajustar posições do modelo" });
  const graduation = dialog.getByRole("button", { name: /^Graduação: arraste/ });
  await graduation.focus();
  await graduation.press("Shift+ArrowUp");
  await expect(dialog.getByLabel("Linha de base")).toHaveValue("332.4");
  await dialog.getByRole("button", { name: "Restaurar padrão" }).click();
  await dialog.getByRole("button", { name: /^Graduação: arraste/ }).focus();
  await expect(dialog.getByLabel("Linha de base")).toHaveValue("322.4");
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await expect(dialog).toBeHidden();
});

test("fits a phone screen without horizontal scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("./");
  await upload(page, "alunos-aptos.docx", await buildDocx(CLASS_DOCX), MIME.docx);
  await page.getByRole("button", { name: "Conferir alunos" }).click();
  await expect(nameInputs(page)).toHaveCount(6);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
