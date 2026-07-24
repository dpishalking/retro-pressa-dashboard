(function () {
  var form = document.getElementById("lead-form");
  var formBlock = document.getElementById("form-block");
  var successBlock = document.getElementById("success-block");
  var successText = document.getElementById("success-text");
  var submitBtn = document.getElementById("submit-btn");

  if (!form || !formBlock || !successBlock || !successText || !submitBtn) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var data = new FormData(form);
    var birthDate = String(data.get("birthDate") || "").trim();
    var phone = String(data.get("phone") || "").trim();
    var name = String(data.get("name") || "").trim();

    if (!birthDate || !phone) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Отправляю...";

    var params = new URLSearchParams(window.location.search);
    var payload = {
      birthDate: birthDate,
      name: name,
      phone: phone,
      landing: "/gift2man",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      utm_content: params.get("utm_content") || "",
      utm_term: params.get("utm_term") || ""
    };

    window.setTimeout(function () {
      // Prototype only — no CRM/service backend yet.
      console.info("gift2man lead", payload);
      formBlock.hidden = true;
      successText.textContent =
        "Мы проверим наличие издания на " + birthDate + " и свяжемся с вами.";
      successBlock.hidden = false;
    }, 500);
  });
})();
