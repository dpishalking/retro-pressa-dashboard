"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { TrainingLayout } from "@/components/training/training-layout";
import { useTrainingUser } from "@/components/training/training-context";
import type { ProductTrainingModule, TrainingOverview, TrainingUser, UserTrainingProgress } from "@/types/training";

type ManagerRow = {
  manager: TrainingUser;
  progress: UserTrainingProgress;
  overview: TrainingOverview;
};

function ProductsTable({
  products,
  onRefresh
}: {
  products: ProductTrainingModule[];
  onRefresh: () => void;
}) {
  const remove = async (id: string) => {
    if (!window.confirm("Удалить продукт?")) return;
    await fetch(`/api/training/products/${id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className="card table-scroll">
      <table>
        <thead>
          <tr>
            <th>Продукт</th>
            <th>Вопросы</th>
            <th>Проходной балл</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                <p className="font-bold text-slate-900">{product.title}</p>
                <p className="max-w-md whitespace-normal text-xs text-slate-500">{product.shortDescription}</p>
              </td>
              <td>{product.questions.length}</td>
              <td>{product.passingScore}%</td>
              <td>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/training/admin/products/${product.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil size={14} />
                    Редактировать
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(product.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ManagerProgressTable({ rows }: { rows: ManagerRow[] }) {
  return (
    <div className="card table-scroll">
      <table>
        <thead>
          <tr>
            <th>Менеджер</th>
            <th>Прогресс</th>
            <th>Пройдено</th>
            <th>Тесты</th>
            <th>Попытки</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ manager, overview, progress }) => (
            <tr key={manager.id}>
              <td className="font-bold text-slate-900">{manager.name}</td>
              <td>{overview.overallPercent}%</td>
              <td>
                {overview.completedProducts}/{overview.totalProducts}
              </td>
              <td>{overview.passedTests}</td>
              <td>{progress.attempts.length}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminContent() {
  const { isAdmin } = useTrainingUser();
  const [tab, setTab] = useState<"products" | "progress">("products");
  const [products, setProducts] = useState<ProductTrainingModule[]>([]);
  const [rows, setRows] = useState<ManagerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [productsResponse, progressResponse] = await Promise.all([
      fetch("/api/training/products"),
      fetch("/api/training/progress?all=true")
    ]);
    const productsData = await productsResponse.json();
    const progressData = await progressResponse.json();
    setProducts(productsData.products);
    setRows(progressData.rows);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  if (!isAdmin) {
    return (
      <div className="card p-8">
        <p className="text-sm text-slate-700">Админ-панель обучения доступна только администратору системы.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="card p-8 text-sm text-slate-600">Загрузка админ-панели...</div>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("products")}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "products" ? "bg-violet-600 text-white" : "bg-white text-slate-700"}`}
        >
          Продукты
        </button>
        <button
          type="button"
          onClick={() => setTab("progress")}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "progress" ? "bg-violet-600 text-white" : "bg-white text-slate-700"}`}
        >
          Прогресс менеджеров
        </button>
      </div>

      {tab === "products" ? (
        <>
          <div className="mb-4">
            <Link
              href="/training/admin/products/new"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700"
            >
              <Plus size={16} />
              Добавить продукт
            </Link>
          </div>
          <ProductsTable products={products} onRefresh={() => void load()} />
        </>
      ) : (
        <ManagerProgressTable rows={rows} />
      )}
    </>
  );
}

export function TrainingAdmin() {
  return (
    <TrainingLayout
      title="Админ-панель обучения"
      description="Управление продуктами, материалами, тестами и прогрессом менеджеров."
      backHref="/training"
      backLabel="К обучению"
    >
      <AdminContent />
    </TrainingLayout>
  );
}
