import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Données traitées par AllDown, finalités, durées de conservation et droits des personnes.",
  alternates: {
    canonical: "/confidentialite",
  },
};

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      description="AllDown est conçu pour traiter le minimum de données nécessaire au téléchargement d'un média. Cette page décrit ce qui est réellement collecté et pourquoi."
    >
      <section className="space-y-2">
        <h2>Responsable du traitement</h2>
        <p>
          AllDown est un service autohébergé. L&apos;administrateur du
          déploiement concerné est responsable du traitement des données
          décrites ci-dessous.
        </p>
        {contactEmail ? (
          <p>
            Contact :{" "}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
        ) : (
          <p>
            Le contact de l&apos;administrateur est indiqué dans le pied de page
            du déploiement.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2>Données traitées</h2>
        <ul>
          <li>
            <strong>L&apos;URL du média</strong> que vous soumettez, afin
            d&apos;interroger la source et de préparer le fichier demandé. Elle
            n&apos;est pas conservée dans une base de données.
          </li>
          <li>
            <strong>Les métadonnées renvoyées par la source</strong> (titre,
            miniature, durée, formats) pour afficher le résultat de
            l&apos;analyse.
          </li>
          <li>
            <strong>Des journaux techniques</strong> : adresse IP, date et heure,
            route appelée, code de réponse et durée. Les URL de médias sont
            expurgées des journaux.
          </li>
          <li>
            <strong>Un jeton de téléchargement signé</strong>, de courte durée,
            permettant de lancer le fichier sans nouveau formulaire. Il contient
            les informations nécessaires au téléchargement et expire rapidement.
          </li>
        </ul>
        <p>
          AllDown ne demande aucun compte, mot de passe, adresse e-mail ni numéro
          de téléphone. Le service ne dépose pas de cookie publicitaire ou de
          mesure d&apos;audience.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Finalités et bases légales</h2>
        <ul>
          <li>
            Fournir le service demandé : analyse du lien et livraison du fichier
            (exécution du service).
          </li>
          <li>
            Protéger le service contre les abus, limiter le débit et sécuriser
            les téléchargements (intérêt légitime).
          </li>
          <li>
            Respecter les obligations légales applicables à l&apos;éditeur
            (obligation légale).
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>Durées de conservation</h2>
        <p>
          Les fichiers téléchargés sont écrits dans un dossier temporaire propre
          à chaque requête, puis supprimés dès la fin de l&apos;envoi ou en cas
          d&apos;interruption. Les jetons de téléchargement expirent après
          quelques minutes. Les journaux techniques sont conservés selon la
          politique de l&apos;hébergeur et du responsable du déploiement.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Destinataires et transferts</h2>
        <p>
          Les données peuvent être traitées par l&apos;hébergeur du service et
          être transmises aux plateformes sources contactées pour analyser le
          lien. AllDown ne vend ni ne loue de données personnelles. Selon
          l&apos;emplacement de l&apos;hébergement et des sources interrogées,
          des transferts hors de l&apos;Union européenne peuvent avoir lieu.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Vos droits</h2>
        <p>
          Vous pouvez demander l&apos;accès, la rectification ou
          l&apos;effacement des données vous concernant, ainsi que la limitation
          ou l&apos;opposition à leur traitement, dans les conditions prévues par
          le RGPD. Utilisez le contact indiqué ci-dessus. Vous pouvez également
          introduire une réclamation auprès de la{" "}
          <a
            href="https://www.cnil.fr/fr/plaintes"
            target="_blank"
            rel="noopener noreferrer"
          >
            CNIL
          </a>{" "}
          ou de l&apos;autorité de contrôle compétente.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Sécurité</h2>
        <p>
          Les liens sont validés avant toute requête réseau afin d&apos;empêcher
          l&apos;accès à des adresses internes. Les commandes du moteur sont
          exécutées sans shell, avec des délais, des limites de taille et un
          nettoyage des fichiers temporaires. En production, le service doit être
          déployé derrière HTTPS.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Modifications</h2>
        <p>
          Cette politique peut évoluer avec le service. La date de dernière mise
          à jour figure en haut de la page.
        </p>
      </section>
    </LegalPage>
  );
}
