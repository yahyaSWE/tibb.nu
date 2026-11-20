export const withdrawalPath = "/friskvard/angra-kop";
export const withdrawalFormPath = "/friskvard/angerblankett";

export function withdrawalFormText(seller: { legalName: string; address: string; email: string }) {
  return [
    "Standardformulär för att ångra köp",
    "Fyll i och skicka formuläret om du vill ångra ditt köp.",
    `Till ${seller.legalName}\n${seller.address}\n${seller.email}`,
    "Jag meddelar att jag frånträder avtalet om följande tjänster:\n",
    "Datum för beställning:\n",
    "Kundens namn:\n",
    "Kundens adress:\n",
    "Datum:\n",
    "Underskrift (om blanketten lämnas på papper):\n",
  ].join("\n\n");
}
