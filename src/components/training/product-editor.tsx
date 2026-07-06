"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import { generateId } from "@/lib/training/id";
import { normalizeProductMaterials } from "@/lib/training/video-embed";
import type { ProductMaterial, ProductSectionKey, ProductTrainingModule, QuizAnswer, QuizQuestion } from "@/types/training";

const emptyProduct = (): ProductTrainingModule => ({
  id: "",
  title: "",
  shortDescription: "",
  coverImage: "https://picsum.photos/seed/new-product/800/500",
  passingScore: 80,
  description: "",
  targetAudience: "",
  clientProblems: "",
  emotions: "",
  purchaseReasons: "",
  objections: "",
  presentationGuide: "",
  materials: [],
  questions: [],
  sortOrder: 999,
  createdAt: "",
  updatedAt: ""
});

function Field({
  label,
  value,
  onChange,
  multiline = false
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
      {multiline ? (
        <textarea
          className="min-h-28 w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function ProductEditorContent({ productId }: { productId: string }) {
  const router = useRouter();
  const { isAdmin } = useTrainingUser();
  const isNew = productId === "new";
  const [product, setProduct] = useState<ProductTrainingModule>(emptyProduct());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/training/products/${productId}?raw=1`)
      .then((response) => response.json())
      .then((data: { product: ProductTrainingModule }) => setProduct(data.product))
      .finally(() => setLoading(false));
  }, [isNew, productId]);

  const update = <K extends keyof ProductTrainingModule>(key: K, value: ProductTrainingModule[K]) => {
    setProduct((current) => ({ ...current, [key]: value }));
  };

  const addMaterial = () => {
    const material: ProductMaterial = {
      id: generateId("material"),
      type: "text",
      title: "Новый материал",
      content: "",
      sortOrder: product.materials.length + 1
    };
    update("materials", [...product.materials, material]);
  };

  const addQuestion = () => {
    const question: QuizQuestion = {
      id: generateId("question"),
      text: "Новый вопрос",
      type: "single",
      sortOrder: product.questions.length + 1,
      answers: [
        { id: generateId("answer"), text: "Вариант 1", isCorrect: true },
        { id: generateId("answer"), text: "Вариант 2", isCorrect: false }
      ]
    };
    update("questions", [...product.questions, question]);
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    const payload = {
      ...product,
      title: product.title.trim(),
      shortDescription: product.shortDescription.trim(),
      materials: normalizeProductMaterials(product.materials)
    };

    const response = await fetch(isNew ? "/api/training/products" : `/api/training/products/${product.id}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setSaving(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(data?.error ?? "Не удалось сохранить изменения. Попробуйте ещё раз.");
      return;
    }

    const data = await response.json();
    setProduct(data.product);
    router.push(`/training/admin/products/${data.product.id}`);
  };

  if (!isAdmin) {
    return (
      <div className="card p-8 text-sm text-slate-600">
        Редактирование доступно только администратору. Переключите пользователя на «Администратор».
      </div>
    );
  }

  if (loading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка продукта...</div>;
  }

  return (
    <div className="space-y-4">
      <section className="card grid gap-4 p-6 md:grid-cols-2">
        <Field label="Название" value={product.title} onChange={(value) => update("title", value)} />
        <Field label="Проходной балл (%)" value={product.passingScore} onChange={(value) => update("passingScore", Number(value) || 80)} />
        <Field label="Короткое описание" value={product.shortDescription} onChange={(value) => update("shortDescription", value)} multiline />
        <Field label="Обложка (URL)" value={product.coverImage} onChange={(value) => update("coverImage", value)} />
        <Field label="Что это за продукт" value={product.description} onChange={(value) => update("description", value)} multiline />
        <Field label="Для кого подходит" value={product.targetAudience} onChange={(value) => update("targetAudience", value)} multiline />
        <Field label="Задачи клиента" value={product.clientProblems} onChange={(value) => update("clientProblems", value)} multiline />
        <Field label="Эмоции" value={product.emotions} onChange={(value) => update("emotions", value)} multiline />
        <Field label="Поводы для покупки" value={product.purchaseReasons} onChange={(value) => update("purchaseReasons", value)} multiline />
        <Field label="Возражения" value={product.objections} onChange={(value) => update("objections", value)} multiline />
        <div className="md:col-span-2">
          <Field label="Как презентовать" value={product.presentationGuide} onChange={(value) => update("presentationGuide", value)} multiline />
        </div>
        <div className="md:col-span-2">
          <Field
            label="Google Slides (URL презентации)"
            value={product.presentationUrl ?? ""}
            onChange={(value) => update("presentationUrl", value)}
          />
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Материалы</h2>
          <button type="button" onClick={addMaterial} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
            <Plus size={14} />
            Добавить материал
          </button>
        </div>
        <div className="space-y-4">
          {product.materials.map((material, index) => (
            <div key={material.id} className="rounded-xl border border-[var(--line)] p-4">
              <div className="mb-3 grid gap-3 md:grid-cols-3">
                <Field
                  label="Заголовок"
                  value={material.title}
                  onChange={(value) => {
                    const materials = [...product.materials];
                    materials[index] = { ...material, title: value };
                    update("materials", materials);
                  }}
                />
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">Тип</span>
                  <select
                    className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                    value={material.type}
                    onChange={(event) => {
                      const materials = [...product.materials];
                      materials[index] = { ...material, type: event.target.value as ProductMaterial["type"] };
                      update("materials", materials);
                    }}
                  >
                    <option value="text">Текст</option>
                    <option value="video">Видео</option>
                    <option value="image">Фото</option>
                    <option value="document">Документ</option>
                    <option value="link">Ссылка</option>
                  </select>
                </label>
                {material.type === "image" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">Блок на странице</span>
                    <select
                      className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                      value={material.sectionKey ?? ""}
                      onChange={(event) => {
                        const materials = [...product.materials];
                        const sectionKey = event.target.value as ProductSectionKey | "";
                        materials[index] = {
                          ...material,
                          sectionKey: sectionKey || undefined
                        };
                        update("materials", materials);
                      }}
                    >
                      <option value="">Галерея (без привязки)</option>
                      <option value="description">Что это за продукт</option>
                      <option value="targetAudience">Для кого подходит</option>
                      <option value="clientProblems">Задачи клиента</option>
                      <option value="emotions">Эмоции</option>
                      <option value="purchaseReasons">Поводы для покупки</option>
                      <option value="objections">Возражения</option>
                      <option value="presentationGuide">Как презентовать</option>
                    </select>
                  </label>
                ) : null}
                <Field
                  label={material.type === "video" ? "Ссылка на YouTube" : "URL"}
                  value={material.type === "video" ? material.url ?? material.embedUrl ?? "" : material.url ?? ""}
                  onChange={(value) => {
                    const materials = [...product.materials];
                    if (material.type === "video") {
                      materials[index] = { ...material, url: value, embedUrl: value };
                    } else {
                      materials[index] = { ...material, url: value };
                    }
                    update("materials", materials);
                  }}
                />
              </div>
              {material.type === "video" ? (
                <p className="mb-3 text-xs leading-5 text-slate-500">
                  Можно вставить обычную ссылку с YouTube, например https://youtu.be/... — при сохранении она автоматически
                  превратится в embed для плеера.
                </p>
              ) : null}
              <Field
                label="Текст / инструкция"
                value={material.content ?? ""}
                onChange={(value) => {
                  const materials = [...product.materials];
                  materials[index] = { ...material, content: value };
                  update("materials", materials);
                }}
                multiline
              />
              <button
                type="button"
                onClick={() => update("materials", product.materials.filter((item) => item.id !== material.id))}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-600"
              >
                <Trash2 size={14} />
                Удалить материал
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-950">Вопросы теста</h2>
          <button type="button" onClick={addQuestion} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">
            <Plus size={14} />
            Добавить вопрос
          </button>
        </div>
        <div className="space-y-4">
          {product.questions.map((question, qIndex) => (
            <div key={question.id} className="rounded-xl border border-[var(--line)] p-4">
              <Field
                label="Текст вопроса"
                value={question.text}
                onChange={(value) => {
                  const questions = [...product.questions];
                  questions[qIndex] = { ...question, text: value };
                  update("questions", questions);
                }}
              />
              <label className="mt-3 block">
                <span className="mb-2 block text-sm font-bold text-slate-700">Тип вопроса</span>
                <select
                  className="w-full rounded-xl border border-[var(--line)] px-4 py-3 text-sm"
                  value={question.type}
                  onChange={(event) => {
                    const questions = [...product.questions];
                    questions[qIndex] = { ...question, type: event.target.value as QuizQuestion["type"] };
                    update("questions", questions);
                  }}
                >
                  <option value="single">Один правильный ответ</option>
                  <option value="multiple">Несколько правильных ответов</option>
                  <option value="text">Открытый текст</option>
                </select>
              </label>

              {question.type !== "text" ? (
                <div className="mt-4 space-y-2">
                  {question.answers.map((answer, aIndex) => (
                    <div key={answer.id} className="flex flex-wrap items-center gap-2">
                      <input
                        className="min-w-[240px] flex-1 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                        value={answer.text}
                        onChange={(event) => {
                          const questions = [...product.questions];
                          const answers = [...question.answers] as QuizAnswer[];
                          answers[aIndex] = { ...answer, text: event.target.value };
                          questions[qIndex] = { ...question, answers };
                          update("questions", questions);
                        }}
                      />
                      <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={answer.isCorrect}
                          onChange={(event) => {
                            const questions = [...product.questions];
                            const answers = [...question.answers] as QuizAnswer[];
                            answers[aIndex] = { ...answer, isCorrect: event.target.checked };
                            questions[qIndex] = { ...question, answers };
                            update("questions", questions);
                          }}
                        />
                        Правильный
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const questions = [...product.questions];
                          questions[qIndex] = {
                            ...question,
                            answers: question.answers.filter((item) => item.id !== answer.id)
                          };
                          update("questions", questions);
                        }}
                        className="text-xs font-bold text-red-600"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const questions = [...product.questions];
                      questions[qIndex] = {
                        ...question,
                        answers: [...question.answers, { id: generateId("answer"), text: "Новый вариант", isCorrect: false }]
                      };
                      update("questions", questions);
                    }}
                    className="text-xs font-bold text-blue-600"
                  >
                    + Добавить вариант
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <Field
                    label="Эталонный ответ (необязательно)"
                    value={question.answers[0]?.text ?? ""}
                    onChange={(value) => {
                      const questions = [...product.questions];
                      questions[qIndex] = {
                        ...question,
                        answers: [{ id: question.answers[0]?.id ?? generateId("answer"), text: value, isCorrect: true }]
                      };
                      update("questions", questions);
                    }}
                    multiline
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => update("questions", product.questions.filter((item) => item.id !== question.id))}
                className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-red-600"
              >
                <Trash2 size={14} />
                Удалить вопрос
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {saveError ? (
          <p className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</p>
        ) : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !product.title.trim()}
          className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          {saving ? "Сохранение..." : isNew ? "Создать продукт" : "Сохранить изменения"}
        </button>
        <Link href="/training/admin" className="rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Назад в админку
        </Link>
      </section>
    </div>
  );
}

export function ProductEditor({ productId }: { productId: string }) {
  return (
    <TrainingLayout
      title={productId === "new" ? "Новый продукт" : "Редактирование продукта"}
      backHref="/training/admin"
      backLabel="К админ-панели"
    >
      <ProductEditorContent productId={productId} />
    </TrainingLayout>
  );
}
