import type { Metadata } from "next";
import Image from "next/image";
import { DashboardLink } from "@/components/site/DashboardLink";
import { SitePage } from "@/components/site/SitePage";

export const metadata: Metadata = {
  title: "About",
  description: "What Watershed Watch is, who it is for, where its map data comes from and what it is not.",
};

export default function AboutPage() {
  return (
    <SitePage>
      <header className="ww-wrap ww-page-head">
        <h1>About Watershed Watch</h1>
        <p className="ww-lead">Watershed Watch is a water quality monitoring system for streams in Central Pennsylvania. It was built for a watershed research program that samples streams at monitoring sites.</p>
      </header>

      <div className="ww-wrap">
      <figure className="ww-photo ww-photo-wide">
        <Image src="/media/penns-creek.webp" alt="Penns Creek winding through forested ridges, seen from Penns View in Bald Eagle State Forest." width={1280} height={773} sizes="(min-width: 1296px) 1200px, calc(100vw - 40px)" priority />
        <figcaption>Penns Creek from Penns View, Bald Eagle State Forest. Photo: <a href="https://commons.wikimedia.org/wiki/File:Flickr_-_Nicholas_T_-_Overseen.jpg">Nicholas A. Tonelli</a>, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>, cropped. It shows a Pennsylvania stream, not a monitoring result.</figcaption>
      </figure>
      </div>

      <div className="ww-wrap ww-prose-grid">
        <section aria-labelledby="who">
          <h2 id="who">Who it’s for</h2>
          <p>Field collectors use the phone app. Reviewers use a private review console. Everyone else can use the public dashboard: residents, students, teachers and researchers who want to see what has been measured, where and when.</p>
        </section>

        <section aria-labelledby="not">
          <h2 id="not">What it is not</h2>
          <p>It isn’t a real-time sensor network or an alert service. Readings are samples taken by people and published after review, so there is always a delay between a sample and its publication.</p>
        </section>

        <section aria-labelledby="map-data">
          <h2 id="map-data">Where the map comes from</h2>
          <p>Watershed boundaries come from the <a href="https://www.usgs.gov/national-hydrography/watershed-boundary-dataset">USGS Watershed Boundary Dataset</a>, shown through Esri’s Living Atlas. Terrain, streams and place names are Esri basemaps. When you select a site, its watershed is looked up from the USGS directly.</p>
          <p>These layers are reference geography, not project measurements. For official water quality assessments, see the EPA’s <a href="https://mywaterway.epa.gov/">How’s My Waterway</a>.</p>
        </section>

        <section aria-labelledby="status">
          <h2 id="status">Where things stand</h2>
          <p>The phone app is being tested with the field team, and the review console and public dashboard are running. No readings have been published yet.</p>
          <p><DashboardLink className="ww-text-link">See the dashboard as it is today</DashboardLink></p>
        </section>
      </div>
    </SitePage>
  );
}
