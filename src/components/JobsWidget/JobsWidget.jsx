import React from "react";
import { FiBriefcase, FiExternalLink } from "react-icons/fi";
import { formatDateTime } from "../../utils/formatters";
import { getSafeExternalUrl } from "../../utils/safeUrl";
import "./JobsWidget.css";

const formatWorkType = (value) => {
  if (value === "full_time") return "Full-time";
  if (value === "contract") return "Contract";
  if (value === "freelance") return "Freelance";
  return "Role";
};

const JobsWidget = ({
  jobSearch,
  onJobSearchChange,
  onJobSearchSubmit,
  jobWorkType,
  onWorkTypeChange,
  jobWorkTypeOptions,
  jobsLoading,
  jobsError,
  jobsMeta,
  jobs,
}) => (
  <article className="panel productivity-jobs">
    <div className="panel-header">
      <div>
        <h3>
          <FiBriefcase /> Recommended jobs
        </h3>
        <p className="muted">Freelance, contract, and full-time roles.</p>
      </div>
    </div>

    <form className="productivity-jobs__search" onSubmit={onJobSearchSubmit}>
      <label className="form-field">
        <span>Role keywords</span>
        <input
          className="input"
          type="text"
          value={jobSearch}
          onChange={(event) => onJobSearchChange(event.target.value)}
          placeholder="react frontend, product designer, devops"
        />
      </label>
      <button className="button button-primary" type="submit" disabled={jobsLoading}>
        {jobsLoading ? "Searching..." : "Find jobs"}
      </button>
    </form>

    <div className="segmented productivity-jobs__types" role="tablist" aria-label="Job type">
      {jobWorkTypeOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segment ${jobWorkType === option.value ? "is-active" : ""}`}
          onClick={() => onWorkTypeChange(option.value)}
          aria-pressed={jobWorkType === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>

    {jobsError ? (
      <div className="notice is-error" role="alert">
        {jobsError}
      </div>
    ) : null}

    {jobsMeta.warning ? <div className="notice">{jobsMeta.warning}</div> : null}

    {jobsLoading ? (
      <div className="loading-card" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>Loading recommendations...</span>
      </div>
    ) : (
      <div className="productivity-jobs__list">
        {jobs.length ? (
          jobs.map((job) => {
            const safeJobUrl = getSafeExternalUrl(job.jobUrl);

            return (
              <article className="productivity-job-card" key={job.id}>
                <div className="productivity-job-card__meta">
                  <span className="status-pill is-info">{formatWorkType(job.workType)}</span>
                  <span className="muted">{job.source}</span>
                </div>
                <div className="table-strong">{job.title}</div>
                <div className="muted">
                  {job.companyName} • {job.location}
                </div>
                {job.salary ? <div className="muted">{job.salary}</div> : null}
                <div className="productivity-job-card__footer">
                  <span className="muted">
                    {job.publishedAt ? formatDateTime(job.publishedAt) : "Recent listing"}
                  </span>
                  {safeJobUrl ? (
                    <a
                      className="button button-ghost"
                      href={safeJobUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <FiExternalLink />
                      Apply
                    </a>
                  ) : (
                    <span className="muted">Apply link unavailable</span>
                  )}
                </div>
              </article>
            );
          })
        ) : (
          <p className="muted productivity-jobs__empty">No roles found for this filter yet.</p>
        )}
      </div>
    )}
  </article>
);

export default JobsWidget;
