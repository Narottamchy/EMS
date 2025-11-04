import React from 'react';

// Base skeleton component with shimmer effect
const Skeleton = ({ className = '', children, ...props }) => (
  <div className={`animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%] rounded ${className}`} {...props}>
    {children}
  </div>
);

// Skeleton for text elements
export const SkeletonText = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        className={`h-4 ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
);

// Skeleton for buttons
export const SkeletonButton = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'h-8 w-20',
    md: 'h-10 w-24',
    lg: 'h-12 w-32',
  };
  
  return <Skeleton className={`${sizeClasses[size]} ${className}`} />;
};

// Skeleton for cards
export const SkeletonCard = ({ className = '', children }) => (
  <div className={`bg-white/5 rounded-2xl border border-white/10 p-6 backdrop-blur-lg ${className}`}>
    {children}
  </div>
);

// Skeleton for icons
export const SkeletonIcon = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };
  
  return <Skeleton className={`${sizeClasses[size]} rounded-full ${className}`} />;
};

// Skeleton for input fields
export const SkeletonInput = ({ className = '' }) => (
  <Skeleton className={`h-12 w-full rounded-xl ${className}`} />
);

// Skeleton for stat cards
export const SkeletonStatCard = () => (
  <SkeletonCard className="hover-lift">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="p-3 bg-white/10 rounded-xl">
        <SkeletonIcon size="lg" />
      </div>
    </div>
  </SkeletonCard>
);

// Skeleton for status cards
export const SkeletonStatusCard = () => (
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-lg">
    <div className="flex items-center">
      <SkeletonIcon className="mr-3" />
      <Skeleton className="h-5 w-20" />
    </div>
    <Skeleton className="h-6 w-8" />
  </div>
);

// Skeleton for table rows
export const SkeletonTableRow = () => (
  <div className="flex items-center space-x-4 py-4">
    <Skeleton className="h-4 w-48" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-4 w-24" />
  </div>
);

// Skeleton for list items
export const SkeletonListItem = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-3 w-2/3" />
    <Skeleton className="h-3 w-1/2" />
  </div>
);

// Skeleton for campaign cards
export const SkeletonCampaignCard = () => (
  <div className="block p-4 border border-white/10 rounded-xl">
    <div className="flex items-center justify-between">
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  </div>
);

// Skeleton for quick action cards
export const SkeletonQuickAction = () => (
  <div className="flex items-center p-6 border-2 border-dashed border-white/10 rounded-xl">
    <SkeletonIcon size="lg" className="mr-4" />
    <div className="space-y-2">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-48" />
    </div>
  </div>
);

// Dashboard skeleton
export const DashboardSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-64 sm:w-80" />
      </div>
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
    </div>

    {/* Stats Grid Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonStatCard key={index} />
      ))}
    </div>

    {/* Campaign Status & Queue Status Skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      <SkeletonCard>
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStatusCard key={index} />
          ))}
        </div>
      </SkeletonCard>
      
      <SkeletonCard>
        <Skeleton className="h-6 w-24 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStatusCard key={index} />
          ))}
        </div>
      </SkeletonCard>
    </div>

    {/* Quick Actions Skeleton */}
    <SkeletonCard>
      <Skeleton className="h-6 w-28 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonQuickAction key={index} />
        ))}
      </div>
    </SkeletonCard>
  </div>
);

// EmailList skeleton
export const EmailListSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <SkeletonButton size="lg" className="w-full sm:w-auto" />
      </div>
    </div>

    {/* Stats Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonCard key={index} className="hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-white/10 rounded-xl relative overflow-hidden">
              <Skeleton className="w-6 h-6 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>

    {/* Search Skeleton */}
    <SkeletonCard>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Skeleton className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" />
            <Skeleton className="h-10 w-full pl-10" />
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Email List Skeleton */}
    <SkeletonCard>
      <div className="px-6 py-4 border-b border-white/10">
        <Skeleton className="h-6 w-40" />
      </div>
      
      {/* Inline List Loading Skeleton */}
      <div className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="h-4 bg-white/10 rounded animate-pulse flex-1"></div>
              <div className="h-4 bg-white/10 rounded animate-pulse w-24"></div>
              <div className="h-4 bg-white/10 rounded animate-pulse w-16"></div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonCard>

    {/* Pagination Skeleton */}
    <SkeletonCard>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-3">
          <SkeletonButton size="sm" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <SkeletonButton size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-16" />
          <SkeletonButton size="sm" />
        </div>
      </div>
    </SkeletonCard>
  </div>
);

// UnsubscribedUsers skeleton
export const UnsubscribedUsersSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <SkeletonButton size="lg" className="w-full sm:w-auto" />
      </div>
    </div>

    {/* Stats Cards Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonCard key={index} className="hover-lift relative overflow-hidden">
          <div className="flex items-center">
            <div className="p-3 bg-white/10 rounded-xl relative overflow-hidden">
              <Skeleton className="w-6 h-6 relative z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer"></div>
            </div>
            <div className="ml-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>

    {/* Search Skeleton */}
    <SkeletonCard>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Skeleton className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" />
            <Skeleton className="h-10 w-full pl-10" />
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Unsubscribed Users List Skeleton */}
    <SkeletonCard>
      <div className="px-6 py-4 border-b border-white/10">
        <Skeleton className="h-6 w-48" />
      </div>
      
      {/* Inline List Loading Skeleton */}
      <div className="p-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="h-4 bg-white/10 rounded animate-pulse flex-1"></div>
              <div className="h-4 bg-white/10 rounded animate-pulse w-24"></div>
              <div className="h-4 bg-white/10 rounded animate-pulse w-16"></div>
            </div>
          ))}
        </div>
      </div>
    </SkeletonCard>

    {/* Pagination Skeleton */}
    <SkeletonCard>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center gap-3">
          <SkeletonButton size="sm" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <SkeletonButton size="sm" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-16" />
          <SkeletonButton size="sm" />
        </div>
      </div>
    </SkeletonCard>
  </div>
);

// Campaigns skeleton
export const CampaignsSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-64 sm:w-80" />
      </div>
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
    </div>

    {/* Filters Skeleton */}
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <SkeletonInput />
      </div>
      <div className="w-full sm:w-48">
        <SkeletonInput />
      </div>
    </div>

    {/* Campaigns List Skeleton */}
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonCard key={index} className="hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* Campaign header with name and status */}
              <div className="flex items-center gap-3 mb-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              
              {/* Description */}
              <Skeleton className="h-4 w-full mb-4" />
              
              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>

              {/* Date info */}
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 ml-4">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  </div>
);

// Templates skeleton
export const TemplatesSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 sm:w-64" />
        <Skeleton className="h-4 w-64 sm:w-80" />
      </div>
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
    </div>

    {/* Templates Grid Skeleton */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonCard key={index} className="hover:shadow-md transition-shadow">
          <div className="space-y-4">
            {/* Header with title and status badge */}
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            
            {/* Template info */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Footer with actions */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <Skeleton className="h-4 w-24" />
              <div className="btn-group">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  </div>
);

// Campaign Detail skeleton
export const CampaignDetailSkeleton = () => (
  <div className="space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center gap-4">
      <SkeletonIcon />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 sm:w-80" />
        <Skeleton className="h-4 w-48 sm:w-64" />
      </div>
    </div>

    {/* Campaign Info Skeleton */}
    <SkeletonCard>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Stats Skeleton */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonStatCard key={index} />
      ))}
    </div>

    {/* Actions Skeleton */}
    <SkeletonCard>
      <div className="flex flex-col sm:flex-row flex-wrap gap-4">
        <SkeletonButton size="lg" className="w-full sm:w-auto" />
        <SkeletonButton size="lg" className="w-full sm:w-auto" />
        <SkeletonButton size="lg" className="w-full sm:w-auto" />
      </div>
    </SkeletonCard>
  </div>
);

// Campaign Simulation skeleton
export const CampaignSimulationSkeleton = () => (
  <div className="max-w-6xl mx-auto space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center gap-4">
      <SkeletonIcon />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 sm:w-80" />
        <Skeleton className="h-4 w-48 sm:w-64" />
      </div>
    </div>

    {/* Simulation Controls Skeleton */}
    <SkeletonCard>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-20" />
            <SkeletonInput />
            <Skeleton className="h-3 w-48" />
          </div>
          <SkeletonButton size="lg" className="w-full sm:w-auto" />
        </div>
      </div>
    </SkeletonCard>

    {/* Results Skeleton */}
    <SkeletonCard>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStatCard key={index} />
          ))}
        </div>
      </div>
    </SkeletonCard>
  </div>
);

// Template Form skeleton
export const TemplateFormSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center gap-4">
      <SkeletonIcon />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 sm:w-80" />
        <Skeleton className="h-4 w-48 sm:w-64" />
      </div>
    </div>

    {/* Form Skeleton */}
    <SkeletonCard>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <SkeletonInput />
            <Skeleton className="h-3 w-64" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <SkeletonInput />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-3 w-56" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <SkeletonButton size="sm" />
            </div>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Actions Skeleton */}
    <div className="flex flex-col sm:flex-row justify-end gap-4">
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
    </div>
  </div>
);

// View Template skeleton
export const ViewTemplateSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center gap-4">
      <SkeletonIcon />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 sm:w-80" />
        <Skeleton className="h-4 w-48 sm:w-64" />
      </div>
    </div>

    {/* Template Info Skeleton */}
    <SkeletonCard>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Actions Skeleton */}
    <div className="flex flex-col sm:flex-row justify-end gap-4">
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
    </div>
  </div>
);

// Create Campaign skeleton
export const CreateCampaignSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-6">
    {/* Header Skeleton */}
    <div className="flex items-center gap-4">
      <SkeletonIcon />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 sm:w-80" />
        <Skeleton className="h-4 w-48 sm:w-64" />
      </div>
    </div>

    {/* Form Skeleton */}
    <SkeletonCard>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <SkeletonInput />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <SkeletonInput />
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Configuration Skeleton */}
    <SkeletonCard>
      <div className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="space-y-2">
              <SkeletonInput />
              <SkeletonInput />
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <SkeletonInput />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <SkeletonInput />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <SkeletonInput />
            </div>
          </div>
        </div>
      </div>
    </SkeletonCard>

    {/* Actions Skeleton */}
    <div className="flex flex-col sm:flex-row justify-end gap-4">
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
      <SkeletonButton size="lg" className="w-full sm:w-auto" />
    </div>
  </div>
);
