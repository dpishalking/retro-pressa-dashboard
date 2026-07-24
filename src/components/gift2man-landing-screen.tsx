"use client";

import { useEffect, useState, type FormEvent } from "react";
import styles from "@/components/gift2man-landing.module.css";

type FormState = {
  birthDate: string;
  name: string;
  phone: string;
};

type SubmitState = "idle" | "loading" | "ok";

type UtmParams = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

const emptyUtm: UtmParams = {
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_content: "",
  utm_term: ""
};

export function Gift2manLandingScreen() {
  const [form, setForm] = useState<FormState>({ birthDate: "", name: "", phone: "" });
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [utm, setUtm] = useState<UtmParams>(emptyUtm);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtm({
      utm_source: params.get("utm_source") ?? "",
      utm_medium: params.get("utm_medium") ?? "",
      utm_campaign: params.get("utm_campaign") ?? "",
      utm_content: params.get("utm_content") ?? "",
      utm_term: params.get("utm_term") ?? ""
    });
  }, []);

  const scrollToForm = () => {
    document.getElementById("gift2man-lead")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.birthDate.trim() || !form.phone.trim()) return;

    setSubmitState("loading");
    window.setTimeout(() => {
      // Prototype only: later wire to Bitrix source UC_MXX4PR / familia-studio.com
      console.info("gift2man lead prototype", { ...form, ...utm, landing: "/gift2man" });
      setSubmitState("ok");
    }, 650);
  };

  return (
    <main className={styles.root}>
      <section className={styles.hero} aria-label="Familia Studio">
        <div className={styles.heroVisual} aria-hidden />
        <div className={styles.heroShade} aria-hidden />
        <div className={styles.paperPlane} aria-hidden />

        <div className={styles.heroContent}>
          <p className={styles.brand}>
            Familia
            <span>Studio</span>
          </p>
          <h1 className={styles.headline}>Подарок, после которого молчат — и листают</h1>
          <p className={styles.support}>
            Настоящая газета из дня его рождения. Для папы, мужа, руководителя — когда «просто вещь» уже не
            подходит.
          </p>
          <div className={styles.ctaRow}>
            <button type="button" className={styles.ctaPrimary} onClick={scrollToForm}>
              Проверить дату
            </button>
            <button type="button" className={styles.ctaSecondary} onClick={scrollToForm}>
              Оставить заявку
            </button>
          </div>
        </div>
      </section>

      <section className={styles.leadSection} id="gift2man-lead" aria-label="Заявка">
        <div className={styles.leadInner}>
          {submitState === "ok" ? (
            <div className={styles.success}>
              <strong>Заявка принята</strong>
              <p>
                Мы проверим наличие издания на {form.birthDate || "указанную дату"} и свяжемся с вами. Это
                прототип лендинга — позже заявка уйдёт в CRM Familia Studio.
              </p>
            </div>
          ) : (
            <>
              <h2>Проверим дату и соберём подарок</h2>
              <p>Укажите день рождения — ответим, есть ли газета или журнал, и как лучше оформить.</p>
              <form className={styles.form} onSubmit={onSubmit}>
                <div className={styles.field}>
                  <label htmlFor="gift2man-date">Дата рождения</label>
                  <input
                    id="gift2man-date"
                    name="birthDate"
                    type="date"
                    required
                    value={form.birthDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="gift2man-name">Как к вам обращаться</label>
                  <input
                    id="gift2man-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Имя"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="gift2man-phone">Телефон</label>
                  <input
                    id="gift2man-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    placeholder="+371 ..."
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <button type="submit" className={styles.submit} disabled={submitState === "loading"}>
                  {submitState === "loading" ? "Отправляю..." : "Проверить наличие"}
                </button>
              </form>
            </>
          )}
          <p className={styles.footerNote}>familia-studio.com/gift2man · прототип для трафика</p>
        </div>
      </section>
    </main>
  );
}
