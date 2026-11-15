import { Award, MapPin, Globe, Sparkles, CheckCircle2 } from 'lucide-react';

const TEAM_MEMBERS = [
  {
    name: 'Sobia Sattar',
    handle: '@sobiaa',
    country: 'Pakistan',
    isOwner: true,
    role: 'Team Lead',
    focus: 'EIC Visual Data Exploration & Scientific Synthesis',
    avatar: '/team/sobia.png',
  },
  {
    name: 'Moneka Meghwar',
    handle: '@mmoneka11',
    country: 'Pakistan',
    isOwner: false,
    role: 'AI Developer',
    focus: 'Web Application Architecture & Accessible Components',
    avatar: '/team/moneka.png',
  },
  {
    name: 'Sumera Shar',
    handle: '@sumera45',
    country: 'Pakistan',
    isOwner: false,
    role: 'Presentation Lead',
    focus: 'NetCDF / GeoTIFF Ingestion & Feature Normalization',
    avatar: '/team/sumera.png',
  },
  {
    name: 'Muhammad Azfar',
    handle: '@azfarqa',
    country: 'Pakistan',
    isOwner: false,
    role: 'Frontend Developer',
    focus: 'FastAPI Backend Services & Performance Verification',
    avatar: '/team/azfar.png',
  },
  {
    name: 'Daya Nand',
    handle: '@nandd1224',
    country: 'Pakistan',
    isOwner: false,
    role: 'Frontend Developer',
    focus: 'Harmonic Pentatonic Scales, Pan Laws & Automated Pytest Suites',
    avatar: '/team/dayanand.png',
  },
];

const DESIRED_SKILLS = [
  'Artificial Intelligence & Machine Learning',
  'Coding',
  'Data Analysis',
  'Data Visualization',
  'Disaster Response',
  'Earth Science',
  'Education',
  'Graphic Design',
  'Software',
  'Videography/Photography',
  'Virtual Reality',
];

export default function TeamMembers() {
  return (
    <div className="stitch-screen-container">
      {/* Header Banner */}
      <section className="stitch-banner">
        <div className="stitch-banner-content">
          <div className="stitch-banner-tags">
            <span className="stitch-tag accent">NASA SPACE APPS CHALLENGE 2026</span>
            <span className="stitch-tag live">TEAM AI-MINDS</span>
            <span className="stitch-tag">HYDERABAD, PAKISTAN</span>
          </div>

          <h2 className="stitch-banner-title">
            Team Members &amp; Research Collective
          </h2>
          <p className="stitch-banner-desc">
            An interdisciplinary team of engineers, data scientists, and audio researchers based in Hyderabad, Pakistan, collaborating on <em>The Earth Information Jukebox</em> challenge to bring inclusive auditory planetary science to the world.
          </p>
        </div>

        <div className="stitch-banner-actions">
          <div className="stitch-status-pill">
            <CheckCircle2 size={16} className="text-secondary" aria-hidden="true" />
            <span>NASA Space Apps 2026</span>
          </div>
        </div>
      </section>

      {/* Main Layout: Members Grid + Team Information Sidebar */}
      <div className="team-layout-grid">
        {/* Members Column (2x3 Grid) */}
        <div className="team-members-column">
          <div className="stitch-section-header">
            <div className="stitch-header-left">
              <span className="stitch-section-title">Team Roster</span>
              <span className="stitch-count-chip">05 Members</span>
            </div>
            <div className="stitch-header-right">
              <span className="stitch-mono-label">VERIFIED PARTICIPANTS</span>
            </div>
          </div>

          <div className="team-cards-grid">
            {TEAM_MEMBERS.map((member) => (
              <article key={member.handle} className="team-member-card">
                <div className="member-top-row">
                  <div className="member-avatar-wrap">
                    <img
                      src={member.avatar}
                      alt={member.name}
                      className="member-avatar-img"
                      onError={(e) => {
                        // Fallback generic avatar if image fails
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="member-avatar-fallback">
                      {member.name.charAt(0)}
                    </div>
                    {member.isOwner && (
                      <span className="owner-badge-indicator" title="Team Owner">
                        ★
                      </span>
                    )}
                  </div>

                  <div className="member-meta">
                    <div className="member-name-row">
                      <h3 className="member-name">{member.name}</h3>
                      {member.isOwner && (
                        <span className="team-owner-tag">Team Owner</span>
                      )}
                    </div>
                    <span className="member-handle">{member.handle}</span>
                    <span className="member-country">
                      <MapPin size={12} aria-hidden="true" />
                      {member.country}
                    </span>
                  </div>
                </div>

                <div className="member-body">
                  <div className="member-role-badge">
                    <Award size={13} className="text-primary" aria-hidden="true" />
                    <span>{member.role}</span>
                  </div>
                  <p className="member-focus-text">{member.focus}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Sidebar: Official Details & Skills */}
        <aside className="team-sidebar">
          {/* Official Team AI-MINDS Poster Card */}
          <div className="stitch-guide-card team-banner-card">
            <div className="stitch-guide-card-header">
              <div className="flex-items-center gap-2">
                <Sparkles size={16} className="text-primary" aria-hidden="true" />
                <h3 className="guide-card-title">Official Team Banner</h3>
              </div>
              <span className="guide-meta-tag">AI-MINDS</span>
            </div>
            <div className="team-banner-img-wrap">
              <img
                src="/team/team_banner.png"
                alt="NASA Space Apps Challenge 2026 — AI MINDS Team Banner"
                className="team-banner-img"
              />
            </div>
          </div>

          {/* Team Info Card */}
          <div className="stitch-guide-card">
            <div className="stitch-guide-card-header">
              <div className="flex-items-center gap-2">
                <Globe size={16} className="text-primary" aria-hidden="true" />
                <h3 className="guide-card-title">Team Information</h3>
              </div>
              <span className="guide-meta-tag">NASA 2026</span>
            </div>

            <div className="team-info-list">
              <div className="team-info-item">
                <span className="team-info-label">Team Name</span>
                <span className="team-info-value font-bold text-primary">AI-MINDS</span>
              </div>
              <div className="team-info-item">
                <span className="team-info-label">Local Event</span>
                <span className="team-info-value">Hyderabad, Pakistan, Pakistan</span>
              </div>
              <div className="team-info-item">
                <span className="team-info-label">NASA Challenge</span>
                <span className="team-info-value">The Earth Information Jukebox</span>
              </div>
              <div className="team-info-item">
                <span className="team-info-label">Submission Status</span>
                <span className="team-info-value text-secondary flex-items-center gap-1 font-semibold">
                  <CheckCircle2 size={14} /> Ready for Evaluation
                </span>
              </div>
            </div>
          </div>

          {/* Desired Skills & Interests Card */}
          <div className="stitch-guide-card">
            <div className="stitch-guide-card-header">
              <div className="flex-items-center gap-2">
                <Sparkles size={16} className="text-secondary" aria-hidden="true" />
                <h3 className="guide-card-title">Desired Skills &amp; Interests</h3>
              </div>
            </div>

            <p className="guide-card-desc mb-3">
              Official competency tags registered with NASA Space Apps Challenge 2026:
            </p>

            <div className="skills-pill-wrap">
              {DESIRED_SKILLS.map((skill) => (
                <span key={skill} className="skill-tag-pill">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
