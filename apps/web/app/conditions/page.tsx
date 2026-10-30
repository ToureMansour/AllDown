import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Règles d'utilisation du service AllDown, usages interdits et limites de responsabilité.",
};

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function TermsPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      description="En utilisant AllDown, vous acceptez les règles ci-dessous. Elles encadrent un service technique de récupération de fichiers, pas un catalogue de contenus."
    >
      <section className="space-y-2">
        <h2>Objet du service</h2>
        <p>
          AllDown permet de soumettre l&apos;URL publique d&apos;un média,
          d&apos;obtenir les formats exposés par la source et de télécharger le
          fichier correspondant lorsque cela est techniquement possible. Le
          service ne garantit pas qu&apos;un lien particulier fonctionnera :
          la source peut modifier ses formats, restreindre l&apos;accès ou
          refuser la requête.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Usage autorisé</h2>
        <p>Vous pouvez utiliser AllDown pour :</p>
        <ul>
          <li>télécharger vos propres contenus ;</li>
          <li>
            télécharger des contenus du domaine public ou couverts par une
            licence autorisant la copie ;
          </li>
          <li>
            télécharger des contenus pour lesquels vous disposez de
            l&apos;autorisation du titulaire des droits.
          </li>
        </ul>
        <p>
          Vous devez respecter les conditions d&apos;utilisation de chaque
          plateforme source ainsi que le droit d&apos;auteur applicable.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Usages interdits</h2>
        <ul>
          <li>
            Télécharger ou redistribuer un contenu sans en avoir le droit.
          </li>
          <li>
            Contourner un DRM, une connexion, un paywall, une restriction
            géographique ou un contrôle d&apos;accès.
          </li>
          <li>
            Accéder à des contenus privés, à des données personnelles ou à des
            systèmes qui ne vous appartiennent pas.
          </li>
          <li>
            Surcharger le service, automatiser des requêtes massives, tenter de
            neutraliser les limites de débit ou perturber son fonctionnement.
          </li>
          <li>
            Utiliser le service à des fins illégales, frauduleuses ou
            malveillantes.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>Propriété intellectuelle</h2>
        <p>
          Les contenus téléchargés restent la propriété de leurs titulaires.
          AllDown ne revendique aucun droit sur ces contenus et ne les héberge
          pas durablement. Le nom, l&apos;interface et le code d&apos;AllDown
          restent la propriété de leurs auteurs respectifs.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Disponibilité et limites</h2>
        <p>
          Le service est fourni « en l&apos;état », sans garantie de
          disponibilité, de compatibilité avec une plateforme donnée ou de
          conservation d&apos;un format. Des limites de taille, de débit, de
          concurrence et de durée peuvent s&apos;appliquer. Le service peut être
          suspendu, modifié ou retiré à tout moment.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Responsabilité</h2>
        <p>
          Vous êtes responsable des liens soumis et de l&apos;usage des fichiers
          obtenus. Dans les limites permises par la loi, l&apos;éditeur
          d&apos;AllDown ne peut être tenu responsable des dommages indirects,
          des pertes de données ou des conséquences d&apos;un usage illicite du
          service par un utilisateur.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Contact et droit applicable</h2>
        <p>
          Pour signaler un problème ou poser une question, utilisez le contact
          publié par l&apos;administrateur du déploiement.
          {contactEmail ? (
            <>
              {" "}
              Adresse : <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
            </>
          ) : null}
        </p>
        <p>
          Le droit applicable est celui du pays de l&apos;administrateur du
          déploiement. Les juridictions compétentes sont celles prévues par ce
          droit, sous réserve des règles impératives applicables aux
          consommateurs.
        </p>
      </section>
    </LegalPage>
  );
}
