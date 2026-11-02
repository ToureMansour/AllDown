import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Droits d'auteur",
  description:
    "Rappel des règles de droit d'auteur et procédure de signalement pour AllDown.",
  alternates: {
    canonical: "/droits",
  },
};

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function CopyrightPage() {
  return (
    <LegalPage
      title="Droits d'auteur"
      description="AllDown est un outil technique. Il ne donne aucun droit sur les contenus téléchargés et ne permet pas de contourner les protections mises en place par les plateformes."
    >
      <section className="space-y-2">
        <h2>Un outil, pas une bibliothèque</h2>
        <p>
          AllDown ne propose ni catalogue, ni recherche de contenus, ni stockage
          durable. L&apos;utilisateur fournit lui-même un lien public. Le fichier
          est préparé temporairement pour son téléchargement, puis supprimé. Le
          service ne confère aucune licence sur l&apos;œuvre récupérée.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Ce que vous pouvez télécharger</h2>
        <ul>
          <li>Vos propres créations.</li>
          <li>Les œuvres du domaine public.</li>
          <li>
            Les contenus diffusés sous une licence qui autorise explicitement le
            téléchargement et la réutilisation.
          </li>
          <li>
            Les contenus pour lesquels le titulaire des droits vous a donné son
            autorisation.
          </li>
        </ul>
        <p>
          Dans les autres cas, le téléchargement peut constituer une atteinte au
          droit d&apos;auteur ou aux droits voisins. Vous restez seul responsable
          de l&apos;usage du service et des fichiers obtenus.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Protections techniques</h2>
        <p>
          AllDown ne contourne pas les DRM, les systèmes de connexion, les
          paywalls, les restrictions géographiques ou les contenus privés. Si la
          source exige une authentification ou protège le flux, le
          téléchargement échoue ou n&apos;est pas proposé.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Signaler un contenu</h2>
        <p>
          Si vous êtes titulaire de droits et estimez qu&apos;un lien est utilisé
          en violation de vos droits, contactez l&apos;administrateur du
          déploiement en précisant :
        </p>
        <ul>
          <li>votre identité et vos coordonnées ;</li>
          <li>l&apos;œuvre concernée et la preuve de vos droits ;</li>
          <li>l&apos;URL exacte en cause et la date du constat ;</li>
          <li>
            une déclaration de bonne foi expliquant pourquoi l&apos;usage n&apos;est
            pas autorisé.
          </li>
        </ul>
        <p>
          {contactEmail ? (
            <>
              Adresse de contact :{" "}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </>
          ) : (
            <>
              L&apos;adresse de contact est publiée dans le pied de page du
              déploiement.
            </>
          )}
        </p>
        <p>
          AllDown n&apos;hébergeant pas les fichiers durablement, une demande de
          retrait doit viser la plateforme source lorsque le contenu y est
          hébergé.
        </p>
      </section>
    </LegalPage>
  );
}
